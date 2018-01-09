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

app.post("/webhook", (req, res) => {
    if(req.body.object == "page") {
        req.body.entry.forEach(entry => {
            entry.messaging.forEach(event => {
                if(event.postback) {
                    processPostback(event);
                }
            })
        });

        res.sendStatus(200);
    }
})

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if(payload === "Greeting") {
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token = process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, (error, response, body) => {
            var greeting = "";

            if(error) {
                console.log("Error getting user's name: " + error);
            } else {
                var bodyObj = JSON.parse(body);
                name = bodyObj.first_name;
                greeting = "Hi " + name + ". ";
            }
            var message = greeting + "My name is RanKey bot. Do you want to see some memes?";
            sendMessage(senderId, {text: message});
        });
    }
}

function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipientId: {id: recipientId},
            message: message,
        }
    }, (error, response, body) => {
        console.log("Error sending message :" + error);
    })
}