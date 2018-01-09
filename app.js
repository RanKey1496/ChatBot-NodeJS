var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json())
app.listen((process.env.PORT || 5000));

app.get("/", (req, res) => {
    res.send("Ready!");
});

app.get("/webhook", (req, res) => {
    if (req.query["hub.verify_token"] === "jaime") {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.log("Verification failed. The tokens don't match");
        res.sendStatus(403);
    }
});