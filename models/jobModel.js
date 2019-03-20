let mongoose = require('mongoose')
let jobSchema = new mongoose.Schema({
    title: String, 
    link: String,
    agency: String,
    department: String,
    location: String,
    pay: String,
    dateRange: String
})
module.exports = mongoose.model('Jobs', jobSchema)