require('dotenv').config();
var moment = require('moment');

var express = require('express');
var fetch = require('node-fetch');
var https = require('https');
var parseString = require('xml2js').parseString;
var app = express();
var cors = require('cors');
const key = process.env["GOODREADS_KEY"];
const dbUser = process.env["DB_USER"];
const dbPassword = process.env["DB_PASSWORD"];
var port = process.env.PORT || 3000;
var bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
const scrapeIt = require("scrape-it")

var url = 'mongodb://' + dbUser + ':' + dbPassword + '@ds155934.mlab.com:55934/bookshelf-db';

app.use(cors());
app.use(bodyParser.xml({ limit: '16mb' }));

// https://localhost:3000/?id=78840638&shelf=read&perPage=20
const getReviews = (req, res, id, shelf, sort, perPage, page) => {
    let allReviews = [];
    let allBooks = [];
    let i = 1;

    const go = (page) => https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf +
        "&sort=" + sort + "&key=" + key + "&per_page=" + perPage + "&page=" + page,
        (response) => {
            response.setEncoding('utf8');
            let rawData = '';
            response.on('data', (chunk) => { rawData += chunk; });
            response.on('end', () => {
                try {
                    parseString(rawData, function (err, r) {
                        console.log(r);
                        if (r.html) {
                            console.dir(r.html.body.div)
                        }
                        const data = r.GoodreadsResponse.reviews[0];
                        console.dir(data.review[0].body);
                        const pagination = data['$'];
                        const reviews = data.review.map((r) => r.id);
                        const urls = data.review.map((r) => r.url);
                        const books = data.review.map((r) => {
                            console.log(r.date_added);
                            return {
                                title: r.book[0].title[0],
                                author: r.book[0].authors[0].author[0].name[0],
                                reviewId: r.id[0],
                                reviewUrl: r.url[0],
                                date: r.date_added[0]
                            }
                        });
                        // console.log({ reviews, urls });
                        // console.log(books);
                        console.log({ pagination })
                        // console.log(data)
                        // bookIds = books.map((book) => book.reviewId);
                        allBooks = allBooks.concat(books);
                        // return bookIds
                        console.log({ allBooks });

                        if (pagination.end === pagination.total) {
                        // if (i === 1) {
                            console.log("BOOKS:", books);
                            scrapeReviews(req, res, allBooks);
                        } else {
                            i += 1;
                            setTimeout(() => {
                                go(i);
                            }, 1100)
                        }
                    });
                } catch (e) {
                    console.error('e:', e.message);
                    res.send(e);
                }
            });
        }).on('error', (e) => {
            console.error(`Got error: ${e.message}`);
            res.send(e);
        });

    go(1);
}

app.get('/', function (req, res) {
    const id = req.query.id;
    const shelf = req.query.shelf;
    const sort = req.query.sort;
    const perPage = req.query.per_page;

    const reviews = getReviews(req, res, id, shelf, sort, perPage);
});

app.get('/review', (req, res) => {
    const book_id = req.query.book_id;
    const user_id = req.query.user_id;

    var options = {
        hostname: 'https://www.goodreads.com',
        port: 443,
        path: `/review/show_by_user_and_book.xml?user_id=${user_id}&book_id=${book_id}&key=${key}`,
        method: 'GET'
    };

    https.get(`https://www.goodreads.com/review/show_by_user_and_book.xml?user_id=${user_id}&book_id=${book_id}&key=${key}`,
        (response) => {
            response.setEncoding('utf8');
            let rawData = '';
            response.on('data', (chunk) => { rawData += chunk; });
            response.on('end', () => {
                try {
                    // this will be an object
                    parseString(rawData, function (err, r) {
                        res.send(JSON.stringify(r.GoodreadsResponse.review[0].body));
                    });

                    // this will be the raw XML
                    // console.log(rawData);
                } catch (e) {
                    console.error('e:', e.message);
                    res.send(e);
                }
            });
        }).on('error', (e) => {
            console.error(`Got error: ${e.message}`);
            res.send(e);
        });
});

function scrapeReviews(req, res, books) {
    const reviews = books.map((book) => book.reviewId);
    console.log("REVIEWS:", reviews);
    let reviewsData = [];

    // todo: this should just be books to scrape all
    const promises = books.map((book) => {
        const i = book.reviewId;
        const d = book.date;

        return new Promise((resolve, reject) => {
            const getUrl = (slug) => `https://www.goodreads.com/review/show/${slug}`;

            const scrape = (slug) => scrapeIt(getUrl(slug), {
                title: ".bookTitle",
                author: ".authorName",
                review: {
                    selector: ".reviewText",
                    how: "html"
                }
            }).then(({ data, response }) => {
                if (!data || !data.review || !data.review.length) {
                    resolve();
                }

                // data.review.replace("'", "&apos;");
                // data.review.replace('"', '&quot;');
                data.review = encode(data.review);
                data.review += '<br /><br />See this review and more at <a href="' + getUrl(slug) + '">Goodreads</a>.';
                data.url = getUrl(slug);
                data.title = encode(data.title);
                reviewsData.push(data);
                data.date = d;

                if (i === reviews.length - 1) {
                    // console.log("next scrape is", i + 1);
                    resolve();
                } else {
                    console.log("finished scraping");
                    resolve();
                }
            });

            scrape(i);
        });
    });

    const encode = (rawStr) => rawStr.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
        return '&#'+i.charCodeAt(0)+';';
    });

    // scrape each review
    Promise.all(promises).then((r) => {
        console.log("REVIEWSDATA:", reviewsData);
        let formattedData = "INSERT INTO `yee_posts` (`ID`, `post_author`, `post_date`, `post_date_gmt`, `post_content`, `post_title`, `post_excerpt`, `post_status`, `comment_status`, `ping_status`, `post_password`, `post_name`, `to_ping`, `pinged`, `post_modified`, `post_modified_gmt`, `post_content_filtered`, `post_parent`, `guid`, `menu_order`, `post_type`, `post_mime_type`, `comment_count`) VALUES ";

        reviewsData.forEach((data, i) => {
            let { review, title, author, url, date } = data;
            title = encode(title);

            const mmt = moment(date);
            const formatted = mmt.format("YYYY-MM-DD HH:MM:SS");
            var month = mmt.month() + 1;
            var day = mmt.date();
            var year  = mmt.year();

            // latest wordpress post id
            const currentPostNumber = 1949;

            // dates to go through
            const earliest = "10/18/2017 00:00:00";
            const latest = "05/24/2019 00:00:00"

            if (mmt.isBetween(earliest, latest)) {
                formattedData += (
                    `(${ currentPostNumber + i },2,'${ formatted }','${ formatted }','${ review }','${ title }','','publish','open','open','','${ title.split(" ").join("-").replace("'", "") }','','','${ formatted }','${ formatted }','',0,'https://www.sweetheartseer.com/?p=${ currentPostNumber + i }',0,'post','',0),`
                );
            }
        });

        console.log("FORMATTED DATA:", formattedData);

        // date format col 256 is http://www.sweetheartseerbooks.com/2019/06/01/becoming-by-michelle-obama/
        res.setHeader('content-type', 'text/plain');
        res.send(formattedData);
    }, (e) => console.log({ e }))
        .catch((error) => console.log({ error }));
}

console.log('App listening on port', port);
app.listen(port);