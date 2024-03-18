
const mongoose = require("mongoose");

const userData = mongoose.Schema({
    name : {type : String,required :[ true,"Please enter a name"],unique : [true,"Name already taken"]},
    email : {type : String,required : [true,"Please enter a email"], unique:[true,"Email already exists"]},
    password : {type : String,required : true},
    document : [Object]
});

module.exports = userData