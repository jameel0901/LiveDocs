
const express  = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const signupHandler = require("./pathHandlers/signup.js")
const {connectDb}  = require("./utils/model");
const dotenv = require("dotenv").config();

const port = process.env.PORT;
const app = express();
connectDb();
//Returns middleware that only parses the json data
app.use(bodyParser.json());
// Returns middleware that only parses urlencoded bodies
app.use(bodyParser.urlencoded({ extended: true }));


app.use(cors({
    origin : "*"
}));
app.use("/singup",signupHandler);

app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
})
