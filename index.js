require('dotenv').config();
var express = require('express');
var fetch = require('node-fetch');
var https = require('https');
var parseString = require('xml2js').parseString;
var app = express();
const key = process.env["GOODREADS_KEY"];

app.get('/', function (req, res) {
        console.log(req.query);
        const id = req.query.id;
        const shelf = req.query.shelf;
        const sort = req.query.sort;
        const perPage = req.query.per_page;

        var reviews = null;

        https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf + 
            "&sort=" + sort + "&key=" + key + "&per_page=" + perPage, 
            (response) => {
                // console.log(response);
                response.setEncoding('utf8');
                let rawData = '';
                response.on('data', (chunk) => { rawData += chunk; });
                response.on('end', () => {
                    try {
                        parseString(rawData, function (err, r) {
                            let rev = r.GoodreadsResponse.reviews[0].review;
                            // console.dir(rev);
                            reviews = rev;
                            res.send(rev);
                        });
                    } catch (e) {
                    console.error('e:', e.message);
                    }
                });
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
                res.send(reviews);
            });
    });
        

app.listen(3000);