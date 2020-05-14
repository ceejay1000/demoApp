const bcrypt = require("bcryptjs")
const usersCollection = require("../db").db().collection("users");
const validator = require("validator");

// A package needed to hash emails for the gravatar service
const md5 = require("md5");

let User = function (data, getAvatar) {
  this.data = data;
  this.errors = [];
  if (getAvatar === undefined) {
    getGravatar = false
  };
  if (getAvatar) {
    this.getGravatar();
  };
}

User.prototype.validateUsername = function (username) {
  let pattern = /[A-Za-z]{2,}\d{2,}/g;
  return pattern.test(username);
}

User.prototype.cleanUp = function () {
  if (typeof (this.data.username) !== "string") {
    this.data.username = "";
  }
  if (typeof (this.data.email) !== "string") {
    this.data.email = "";
  }
  if (typeof (this.data.password) !== "string") {
    this.data.password = "";
  }

  //Get rid of any bogous properties
  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password
  }
}

User.prototype.validate = async function () {
  // return new Promise(async (resolve, reject) => {
  if (this.data.username === "") {
    this.errors.push("Username cannot be empty");
  }
  if (this.data.username !== "" && !this.validateUsername(this.data.username)) {
    this.errors.push("Username must be alphanumeric");
  }
  if (!validator.isEmail(this.data.email)) {
    this.errors.push("Email cannot be empty or is invalid");
  }
  if (this.data.password === "") {
    this.errors.push("Password cannot be empty");
  }
  if (this.data.password.length > 0 && this.data.password.length < 12) {
    this.errors.push("Password must be at least 12 characters");
  }
  if (this.data.password.length > 100) {
    this.errors.push("Password cannot exceed 100 characters");
  }
  if (this.data.username.length > 0 && this.data.username.length < 3) {
    this.errors.push("Username must exceed three characters");
  }
  if (this.data.username.length > 30) {
    this.errors.push("Username cannot exceed 30 characters");
  }

  // Only if username is valid, check from database
  if (this.data.username.length > 3 && this.data.username.length < 31 && this.validateUsername(this.data.username)) {
    // Try the code below in a separate project to see what it returns
    let usernameExists = await usersCollection.findOne({
      username: this.data.username
    });
    if (usernameExists) {
      this.errors.push("Username has already been taken");
    }
  }

  if (validator.isEmail(this.data.email)) {
    let emailExists = await usersCollection.findOne({
      email: this.data.email
    });
    if (emailExists) {
      this.errors.push("Email has already been taken :(");
    }
  }
  // resolve();
  //})
}

User.prototype.login = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    usersCollection.findOne({
      username: this.data.username
    }).then((attemptedUser) => {
      if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
        resolve("Congrats");
        this.data = attemptedUser;
        this.getGravatar();
      } else {
        reject("Invalid username or password");
      }
    }).catch(err => console.log("Error => ", err))
  })
}

User.prototype.register = function () {
  return new Promise(async (resolve, reject) => {
    // Step 1: Validate user data
    this.cleanUp();
    await this.validate();

    // Step 2: If no validtions errors save user data to database
    if (!this.errors.length) {
      // hash user password
      let salt = bcrypt.genSaltSync(10);
      this.data.password = bcrypt.hashSync(this.data.password, salt)
      await usersCollection.insertOne(this.data);
      this.getGravatar();
      resolve();
    } else {
      reject(this.errors);
    }
    // Have a look at this in a separate project
    console.log('User data ', this.data);
  })
}

User.prototype.getGravatar = function () {
  this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`;
}

User.findByUsername = function (username) {
  return new Promise((resolve, reject) => {
    if (typeof (username) !== "string") {
      reject();
      return;
    }
    usersCollection.findOne({
      username: username
    }).then((userDoc) => {
      if (userDoc) {
        userDoc = new User(userDoc, true);
        userDoc = {
          _id: userDoc.data._id,
          username: userDoc.data.username,
          avatar: userDoc.avatar
        }
        resolve(userDoc);
      } else {
        reject();
      }
    }).catch(() => {
      reject()
    });
  });
}

User.doesEmailExist = function (email) {
  return new Promise(async function (resolve, reject) {
    if (typeof (email) !== "string") {
      resolve(false);
      return;
    }

    let user = await usersCollection.findOne({
      email: email
    });
    if (user) {
      resolve(true);
    } else {
      reject(false);
    }
  })
}

module.exports = User;