const express = require("express");
const app = express();
const session = require("express-session");
const flash = require("connect-flash");
const markDown = require("marked");
const sanitizeHTML = require("sanitize-html");
const csrf = require("csurf");

// express middleware
app.use(express.urlencoded({
  extended: false
}));
app.use(express.json());

//app.use("/api", require("./router-api"));

// Stores User session in mongodb
const MongoStore = require("connect-mongo")(session);

let sessionOptions = session({
  secret: "JavaScript tuts",
  // store: new MongoStore({object}) enables us tos store user sessions in the db
  store: new MongoStore({
    client: require("./db")
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true
  }
})

app.use(sessionOptions);
app.use(express.static("public"));
app.set("views", "views");
app.set("view engine", "ejs");

app.use(flash());

// This function will run for every request
app.use(function (req, res, next) {
  // make markdown available in all ejs templates
  res.locals.filterUserHTML = function (content) {
    return sanitizeHTML(markDown(content), {
      allowedTags: ['p', 'br', 'strong', 'i', 'em', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      allowedAttributes: {}
    });
  }

  // make all error and success flash messages available from all templates
  res.locals.errors = req.flash("errors");
  res.locals.success = req.flash("success");

  // make current user ID available on the req object
  // res.locals will make any property on it available in all ejs files or view templates
  if (req.session.user) {
    req.visitorId = req.session.user._id;
  } else {
    req.visitorId = 0;
  }

  // make user session data available from with view templates
  res.locals.user = req.session.user;
  next();
})


app.use(csrf());
app.use(function (req, res, next) {
  // This generates a random token and makes it available to all HTML(ejs) templates
  res.locals.csrfToken = req.csrfToken();
  next();
})


// A function handle for failed csrf errors
app.use(function (err, req, res, next) {
  if (err) {
    if (err.code === "EBADCSRFTOKEN") {
      req.flash("errors", "Cross site request forgery detected.");
      req.session.save(() => res.redirect("/"))
    } else {
      res.render("404");
    }
  }
})

const router = require("./router");
app.use("/", router);

const server = require("http").createServer(app);

const io = require("socket.io")(server);

io.use(function (socket, next) {
  // This makes the express server available to socket.io
  sessionOptions(socket.request, socket.request.res, next);
})

io.on("connection", function (socket) {
  // This conditional checks to see if a user has a session or is logged in and make user data available to socket.io
  if (socket.request.session.user) {
    let user = socket.request.session.user;
    socket.emit("welcome", {
      username: user.username,
      avatar: user.avatar
    })
    // socket represents the connection between server and browser
    socket.on("chatMessageFromBrowser", function (data) {
      // io.emit() sends out/emit an event to all connected users(browsers)
      // socket.broadcast.emit() sends out/emit an event to all connected users(browsers) except the browser or socket connection that sent it
      socket.broadcast.emit("chatMessageFromServer", {
        message: sanitizeHTML(data.message, {
          allowedTags: [],
          allowedAttributes: {}
        }),
        username: user.username,
        avatar: user.avatar
      })
    })
  }
})

module.exports = server;