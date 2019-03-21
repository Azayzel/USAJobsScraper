require('dotenv').config()
const sgMail = require('@sendgrid/mail');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
let mongoose = require('mongoose');
const _log = require('./logger/index');
const Logger = new _log('trace');
let results = [];
let totalPages = 0;
var pageNum = 1;
const baseUrl = `https://www.usajobs.gov/Search/?g=13&g=14&g=15&j=2210&hp=fed-competitive&hp=fed-excepted&k=IT%20Specialist&gs=true&smin=85816&smax=155073&p=${pageNum}`;

// SetupKey
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);

//#region  DB Connection && Init

// Connect to MongoDB
mongoose.connect(process.env.MONGODB, { useNewUrlParser: true });
var db = mongoose.connection;

// Once open, Begin Init
db.once('open', function (db) {
    Logger.WriteLog(`Connected to Database. Beginning Scan.`);
    var Job = require('./models/jobModel');
    init(Job);
})

//#endregion

//#region Application Functions

/**
 * Entry Point
 * @param {Job} Job 
 * @see './models/jobModel'
 */
async function init(Job) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(baseUrl, {
        waitUntil: 'networkidle0',
        timeout: (50 * 1000)
    }).catch((err) => Logger.WriteLog(`Error loading page: ${err}`));
    const html = await page.content(); // serialized HTML of page DOM.
    await browser.close();
    var $ = cheerio.load(html);
    let resultCount = $('.usajobs-search-controls__results-count').text().split(" of ")[1].replace(" jobs").trim().replace('undefined','');
    totalPages = Math.ceil(resultCount/10);

    Logger.WriteLog(`Total Pages to scan: ${totalPages}`);

    $('.usajobs-search-result--core')
        .each(function () {
            let a = $(this).find('a');
            let agency = $(this).find('.usajobs-search-result--core__agency').text().replace("\n","").replace("                   ","").trim();
            let department = $(this).find('.usajobs-search-result--core__department').text().replace("\n","").replace("                   ","").trim();
            let location = $(this).find('.usajobs-search-result--core__location-link').text().replace("\n","").replace("                   ","").trim().split('\n')[0];
            let pay = $(this).find('.usajobs-search-result--core__item').text().replace('\n','').replace('                        ').trim().split('\n')[0].replace('undefined','');
            let closing = $(this).find('.usajobs-search-result--core__closing-date').text().replace('\n                Opening and closing dates\n                ','').trim().split('\n')[0];
            let result = {
                "title": a.text().replace("\n","").replace("                   ","").trim().split('\n')[0],
                "link": `https://usajobs.gov${a.attr('href')}`,
                "agency": agency,
                "department": department,
                "location": location,
                "pay": pay,
                "dateRange": closing
            }
            results.push(result);
        });
    // Loop through each site
    // Start loop at Page 2
    for(var i = 2; i <= totalPages; i++){
        let url = `https://www.usajobs.gov/Search/?g=13&g=14&g=15&j=2210&hp=fed-competitive&hp=fed-excepted&k=IT%20Specialist&gs=true&smin=85816&smax=155073&p=${i}`;
        await GetPageData(url, i, totalPages);
    }

    Logger.WriteLog(`Captured ${results.length} results.`);
    Logger.WriteLog(`Analyzing results.`);
    CheckAndWriteToDB(Job);
}

/**
 * Scrape USAJobs URL
 * @param {String} url 
 * @param {Number} i 
 * @param {Number} total 
 */
async function GetPageData(url, i, total){
    Logger.WriteLog(`Scanning Page ${i} of ${total}`);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: (50 * 1000)
    })
    .catch((err) => Logger.WriteLog(`Error loading page: ${err}`));
    const html = await page.content(); // serialized HTML of page DOM.
    await browser.close();
    var $ = cheerio.load(html);
    $('.usajobs-search-result--core')
        .each(function () {
            let a = $(this).find('a');
            let agency = $(this).find('.usajobs-search-result--core__agency').text().replace("\n","").replace("                   ","").trim();
            let department = $(this).find('.usajobs-search-result--core__department').text().replace("\n","").replace("                   ","").trim();
            let location = $(this).find('.usajobs-search-result--core__location-link').text().replace("\n","").replace("                   ","").trim().split('\n')[0];
            let pay = $(this).find('.usajobs-search-result--core__item').text().replace('\n','').replace('                        ').trim().split('\n')[0].replace('undefined','');
            let closing = $(this).find('.usajobs-search-result--core__closing-date').text().replace('\n                Opening and closing dates\n                ','').trim().split('\n')[0];
            let result = {
                "title": a.text().replace("\n","").replace("                   ","").trim().split('\n')[0],
                "link": `https://usajobs.gov${a.attr('href')}`,
                "agency": agency,
                "department": department,
                "location": location,
                "pay": pay,
                "dateRange": closing
            }
            results.push(result);
        });
}

/**
 * Check Results against DB, write if newer
 *  and send email when done
 * @param {Job} Job 
 * @see './models/jobModel'
 */
function CheckAndWriteToDB(Job){
    var emailData = [];
    var emailDataStr = ``;
    let i = 1;
    if(results.length > 0){
        for(let result of results){
            if(result != undefined){
            Job.find({
                    link: result.link   // search query
                })
                .then(doc => {
                    if(doc.length == 0){
                        let newJob = new Job({
                            title: result.title,
                            link: result.link,
                            agency: result.agency,
                            department: result.department,
                            location: result.location,
                            pay: result.pay,
                            dateRange: result.dateRange
                        });
                        
                        newJob.save()
                            .then((doc) => {
                                let str = ` 
                            
    <table class="table-wrap is-auto-width" style="background: #f4f6f7; padding: 10px;margin-top: 5px;">
    <tr>
        <td><strong>Title:</strong></td>
        <td><span class="mono">${result.title}</span></td>
    </tr>
    <tr>
        <td><strong>Link:</strong></td>
        <td><span class="mono">${result.link}</span></td>
    </tr>
    <tr>
        <td><strong>Agency:</strong></td>
        <td><span class="mono highlighter">${result.agency}</span></td>
    </tr>
    <tr>
        <td><strong>Department:</strong></td>
        <td><span class="mono highlighter">${result.department}</span></td>
    </tr>
    <tr>
        <td><strong>Pay:</strong></td>
        <td><span class="mono highlighter">${result.pay}</span></td>
    </tr>
    <tr>
        <td><strong>Location:</strong></td>
        <td>
            <span class="mono highlighter">
                <a href="https://www.google.com/search?q=redfin+${result.location}"><i class="fas fa-search-location" style="margin-right:3px;"></i> ${result.location}</a>
            </span>
        </td>
    </tr>
    <tr>
        <td><strong>Date Range:</strong></td>
        <td><span class="mono highlighter">${result.dateRange}</span></td>
    </tr>
    </table>
    `;
                                emailDataStr += str;
                                emailData.push(result);
                                if(i == results.length){
                                    SendMail(emailDataStr, emailData.length);
                                }
                                else{
                                    i++; 
                                }
                            })
                            .catch((err) => {
                                Logger.WriteLog(`Error: ${err}`);
                            })
                    }
                    else{
                        if(i == results.length){
                            SendMail(emailDataStr, emailData.length);
                        }
                        else{
                            i++;
                        }
                    }
                })
                .catch(err => {
                    Logger.WriteLog(`Error While Searching: ${err}`);
                })
            }
        };
    }
}

/**
 * Send Email with results
 * @param {String} body 
 * @param {Number} found 
 */
function SendMail(body, found){
    let finalBody, subject;
    if(found > 0){
    finalBody = `
                <header class="flex-header">
                <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
                <div>
                    <div class="flex-header-title">
                    <h3>
                    <i class="fas fa-search" style="margin-right: 5px;"></i>
                        USA Jobs Scraper
                        <span style="margin-left: 100px;">
                            <i class="fas fa-clipboard-list" style="margin-right: 5px;"></i> ${found} Results
                        </span>
                    </h3>
                    </div>
                </div>
                </header>
                <div class="container"> `
                + body + 
                `</container>`
    } 
    else {
        finalBody = `
                    <div class="container" style="text-align: ceter;">
                            <h3>Looks like nothing new was posted</h3>
                            <img src="https://media.giphy.com/media/fhLgA6nJec3Cw/giphy.gif" />

                            <p> **<i>The Scraper will run again in 5 hours</i> </p>
                    </div>`;

    }

    let msg = {
        to: process.env.EMAIL,
        from: process.env.FROM,
        subject: 'USAJobs Data',
        html: finalBody,
    };

    // Send Email
    sgMail.send(msg).then((resp) => {
        Logger.WriteLog(`Sent Email`,resp);
        Logger.WriteLog(`Done.`);
        //process.exit(0);
    }).catch((err) => {
        Logger.WriteLog(`Error Sending Email: ${err}`);
    })
}

//#endregion

