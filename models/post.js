const postCollection = require("../db").db().collection("posts");
const followsCollection = require("../db").db().collection("follows");
const ObjectID = require("mongodb").ObjectID;
const User = require("./User");
const sanitizeHTML = require("sanitize-html");

let Post = function (data, userID, requestedPostId) {
  this.data = data;
  this.errors = [];
  this.requestedPostId = requestedPostId;
  this.userID = userID;
}

Post.prototype.cleanUp = function () {
  if (typeof (this.data.title) !== "string") {
    this.data.title = "";
  }
  if (typeof (this.data.body) !== "string") {
    this.data.body = "";
  }

  // get rid of any other properties
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    createdDate: new Date(),
    author: ObjectID(this.userID)
  }
}

Post.prototype.validate = function () {
  if (this.data.title === "") {
    this.errors.push("Title cannot be empty!");
  }

  if (this.data.body === "") {
    this.errors.push("Body cannot be empty!");
  }
}

Post.prototype.createPost = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      // Save posts to db 
      postCollection.insertOne(this.data).then((info) => {
        resolve(info.ops[0]._id);
        console.log(info)
      }).catch(() => {
        // Errors here are database errors, not of the user
        this.errors.push("Please try again later.");
        reject(this.errors);
      })
    } else {
      reject(this.errors);
    }
  })
}

Post.prototype.update = function () {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(this.requestedPostId, this.userID);
      if (post.isVisitorOwner) {
        // actually update the db
        let status = await this.actuallyUpdate();
        resolve(status);
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
}

Post.prototype.actuallyUpdate = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      postCollection.findOneAndUpdate({
        // find a document with a matching ID
        _id: new ObjectID(this.requestedPostId)
      }, {
        // if a match is found, pipe it down to this operation
        $set: {
          title: this.data.title,
          body: this.data.body
        }
      })
      resolve("success");
    } else {
      reject("failure");
    }
  })
}


Post.reusablePostQuery = function (uniqueOperations, visitorId) {
  return new Promise(async function (resolve, reject) {
    let aggOperations = uniqueOperations.concat([{
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorDocument"
        }
      },
      {
        $project: {
          title: 1,
          body: 1,
          createdDate: 1,
          authorId: "$author",
          author: {
            $arrayElemAt: ["$authorDocument", 0]
          }
        }
      }
    ])
    let posts = await postCollection.aggregate(aggOperations).toArray();

    // clean up author property in each post object
    posts = posts.map(post => {
      // equals() is a mongodb method that returns a boolean based on a comparison operation
      post.isVisitorOwner = post.authorId.equals(visitorId);
      //post.authorId = authorId;
      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar
      }
      return post;
    });
    resolve(posts);
  })
}

Post.findSingleById = function (id, visitorId) {
  return new Promise(async function (resolve, reject) {
    if (typeof (id) !== "string" || !ObjectID.isValid(id)) {
      reject("Invalid id");
      return;
    }

    let posts = await Post.reusablePostQuery([{
      $match: {
        _id: new ObjectID(id)
      }
    }], visitorId);
    if (posts.length) {
      resolve(posts[0]);
      console.log(posts[0]);
    } else {
      reject("Connection error!!");
    }
  })
}

Post.findByAuthorId = function (authorId) {
  return Post.reusablePostQuery([{
      $match: {
        author: authorId
      }
    },
    {
      $sort: {
        createdDate: -1
      }
    }
  ])
}

Post.delete = function (postIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(postIdToDelete, currentUserId);
      if (post.isVisitorOwner) {
        await postCollection.deleteOne({
          _id: new ObjectID(postIdToDelete)
        })
        resolve();
      } else {
        reject();
      }
    } catch {
      reject();
    }
  })
}

Post.search = function (searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof (searchTerm) === "string") {
      let posts = await Post.reusablePostQuery([{
        $match: {
          $text: {
            $search: searchTerm
          }
        }
      }, {
        $sort: {
          score: {
            $meta: "textScore"
          }
        }
      }]);
      resolve(posts);
    } else {
      reject();
    }
  })
}

Post.countPostsByAuthor = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      let postCount = await postCollection.countDocuments({
        author: id
      });
      resolve(postCount);
    } catch {
      reject();
    }
  })
}

Post.getFeed = async function (id) {
  // create an array of the user id's the user follow
  let followedUsers = await followsCollection.find({
    authorId: new ObjectID(id)
  }).toArray();

  followedUsers = followedUsers.map(followedUser => {
    return followedUser.followedId
  })

  // look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([{
      $match: {
        author: {
          $in: followedUsers
        }
      }
    },
    {
      $sort: {
        createdDate: -1
      }
    }
  ])
}

module.exports = Post;