const Post = require("../models/Post");

exports.viewCreateScreen = function (req, res) {
  res.render("create-post");
}

exports.createPost = function (req, res) {
  let post = new Post(req.body, req.session.user._id);
  post.createPost().then(function (newID) {
    req.flash("success", "Post created successfully");
    req.session.save(function () {
      res.redirect(`/post/${newID}`);
    })
  }).catch(function (errs) {
    errs.forEach(err => res.flash("errors", err));
    req.session.save(function () {
      res.redirect("/create-post");
    })
  });
}

exports.apiCreate = function (req, res) {
  let post = new Post(req.body, req.apiUser._id);
  post.createPost().then(function (newID) {
    res.json("Congrats");
  }).catch(function (errs) {
    res.json(errs);
  });
}

exports.viewSingle = async function (req, res) {
  console.log("Visitor ID ", req.visitorId);
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    res.render("post", {
      post,
      title: post.title
    });
  } catch {
    res.render("404");
  }
  // Post.findSingleById(req.params.id).then(posts => {
  //   res.render("post", {
  //     post: posts
  //   })
  // }).catch(err => {
  //   res.render("404")
  // })
}

exports.viewEditScreen = async function (req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    if (post.authorId == req.visitorId) {
      res.render("edit-post", {
        post
      });
    } else {
      req.flash("errors", "You cannot perform this action");
      req.session.save(function () {
        res.redirect("/");
      })
    }
  } catch {
    res.render("404");
  }
}

exports.edit = function (req, res) {
  let post = new Post(req.body, req.visitorId, req.params.id);
  post.update().then((status) => {
    // the post was successfully updated in the database
    // or user did have permission, but there were validation errors
    if (status === "success") {
      // post was updated in db
      req.flash("success", "Post updated :)");
      req.session.save(function () {
        res.redirect(`/post/${req.params.id}/edit`);
      })
    } else {
      post.errors.forEach(function (error) {
        req.flash("errors", error)
      })
      req.session.save(function () {
        res.redirect(`/post/${req.params.id}/edit`)
      })
    }
  }).catch(() => {
    // a post with the requested ID does not exist
    // or if the current visitor is not the owner of the requested post
    req.flash("errors", "Action cannot be performed");
    req.session.save(function () {
      res.redirect("/");
    })
  });
}

exports.delete = function (req, res) {
  Post.delete(req.params.id, req.visitorId).then(() => {
    req.flash("success", "Post successfully deleted");
    req.session.save(() => {
      res.redirect(`/profile/${req.session.user.username}`)
    })
  }).catch(() => {
    req.flash("errors", "Request denied");
    req.session.save(() => res.redirect("/"))
  });
}

exports.apiDelete = function (req, res) {
  Post.delete(req.params.id, req.apiUser._id).then(() => {
    res.json("Success")
  }).catch(() => {
    res.json("Request denied")
  });
}

exports.search = function (req, res) {
  Post.search(req.body.searchTerm).then((posts) => {
    res.json(posts)
  }).catch(() => {
    res.json([])
  });
}