// This sets up the environment variables
const dotenv = require("dotenv");
dotenv.config();

const mongodb = require("mongodb");
// connectionString = "mongodb+srv://emmanuel90:RJiIAHdjZdir8GNx@cluster0-emgtn.mongodb.net/ComplexApp?retryWrites=true&w=majority";

mongodb.connect(process.env.CONNECTIONSTRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}, function (err, client) {
  if (err) console.log(err);
  module.exports = client;
  console.log("Database connection established :)");
  const app = require("./app");
  app.listen(process.env.PORT, () => console.log(`Server running at port ${process.env.PORT}`));
});