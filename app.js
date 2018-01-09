var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var mongoose = require("mongoose");

var db = mongoose.connect(process.env.MONGODB_URI);
var Movie = require("./movie");

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
                } else if(event.message) {
                    processMessage(event);
                }
            })
        });

        res.sendStatus(200);
    }
})

function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message
        }
    }, (error, response, body) => {
        console.log("Error sending message :" + error);
        console.log("Error sending message :" + JSON.stringify(response));
        console.log("Error sending message :" + JSON.stringify(body));
    })
}

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if(payload === "Greeting") {
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
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
    } else if (payload === "Correct") {
        sendMessage(senderId, {text: "Awesome! What would you like to find out? Enter 'plot', 'date', 'runtime', 'director', 'cast' or 'rating' for the various details."});
    } else if (payload === "Incorrect") {
        sendMessage(senderId, {text: "Oops! Sorry about that. Try using the exact title of the movie"});
    }
}

function processMessage(event) {
    if(!event.message.is_echo) {
        var message = event.message;
        var senderId = event.sender.id;

        console.log("Received message from senderId: " + senderId);
        console.log("Message is: " + JSON.stringify(message));

        if(message.text) {
            var formattedMsg = message.text.toLowerCase().trim();

            switch(formattedMsg) {
                case "plot":
                case "date":
                case "runtime":
                case "director":
                case "cast":
                case "rating":
                  getMovieDetail(senderId, formattedMsg);
                  break;
        
                default:
                  findMovie(senderId, formattedMsg);
            }
        } else if(message.attachments) {
            sendMessage(senderId, {text: "Sorry, I don't understand your request."});
        }
    }
}

function getMovieDetail(userId, field) {
    Movie.findOne({user_id: userId}, (error, movie) => {
        if(error) {
            sendMessage(userId, {text: "Something went wrong. Try again."});
        } else {
            sendMessage(userId, {text: movie[field]});
        }
    })
}

function findMovie(userId, movieTitle) {
    request("http://www.omdbapi.com/?type=movie&t=" + movieTitle + "&apikey=98461c7e", (error, response, body) => {
      if (!error && response.statusCode === 200) {
        var movieObj = JSON.parse(body);
        if (movieObj.Response === "True") {
          var query = {user_id: userId};
          var update = {
            user_id: userId,
            title: movieObj.Title,
            plot: movieObj.Plot,
            date: movieObj.Released,
            runtime: movieObj.Runtime,
            director: movieObj.Director,
            cast: movieObj.Actors,
            rating: movieObj.imdbRating,
            poster_url:movieObj.Poster
          };
          var options = {upsert: true};
          Movie.findOneAndUpdate(query, update, options, (err, mov) => {
            if (err) {
              console.log("Database error: " + err);
            } else {
              message = {
                attachment: {
                  type: "template",
                  payload: {
                    template_type: "generic",
                    elements: [{
                      title: movieObj.Title,
                      subtitle: "Is this the movie you are looking for?",
                      image_url: movieObj.Poster === "N/A" ? "http://placehold.it/350x150" : movieObj.Poster,
                      buttons: [{
                        type: "postback",
                        title: "Yes",
                        payload: "Correct"
                      }, {
                        type: "postback",
                        title: "No",
                        payload: "Incorrect"
                      }]
                    }]
                  }
                }
              };
              sendMessage(userId, message);
            }
          });
        } else {
            console.log(movieObj.Error);
            sendMessage(userId, {text: movieObj.Error});
        }
      } else {
        sendMessage(userId, {text: "Something went wrong. Try again."});
      }
    });
  }