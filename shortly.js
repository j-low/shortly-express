var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var session = require('express-session');
var app = express();

// adding session middleware
app.use(session({secret: 'kawdfadsfawfewaf',
                saveUninitialized: true,
                resave: true}));
// app.use(express.cookieParser('secret'));
// app.use(express.session());

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// restrict function - to check if request is from a valid session
var restrict = function(req, res, next) {
  // console.log('req.session: ', req.session);
  if(req.session) {
  // next();
    if(req.session.userId) {
       // console.log('session.userID');
      next();
    } else {
    console.log('inside restrict function');
    res.redirect('/login');
    res.send(200);
    }
    // console.log('no userId');
  } else {
    res.redirect('/login');
    // req.session.error = 'Access denied!';
  }
}

app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get('/login',
  function(req, res) {
    res.render('login');
    // res.send(200);
  })

app.get('/signup',
  function(req, res) {
    res.render('signup');
    // res.send(200);
  })

app.post('/signup',
  function(req, res) {
    new User({username: req.body.username, password: req.body.password}).save().then(function(model) {

      res.location('/');
      res.redirect('/');
      res.send(200);

    });
  })

// check for a valid session id, if not a valid session id, then redirect to login
app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', function(req, res) {
  // check the username and password against that stored in database
  // if authenticated, set session id and place that id in user's cookie
  new User({username: req.body.username}).fetch().then(function(model) {
    console.log(model.attributes.username);
      req.session.regenerate(function(err) {
        // console.log('RES: ', res);
        // console.log('req.session ', req.session);
        req.session.userId = model.attributes.username;
        console.log('req.session.userId ', req.session.userId);
        // res.render('links');
      });

  })

});

app.get('/logout', function(req, res) {
  if(req.session) {
    req.session.destroy();
  }
  res.redirect('/');
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
