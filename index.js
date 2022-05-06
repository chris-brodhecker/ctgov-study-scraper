const axios = require('axios');
const cheerio = require('cheerio');
const Papa = require('papaparse')
const fs = require('fs');

// CHANGE THESE STUDY IDS TO WHAT YOU WANT
const studyIds = []
// THIS IS THE FILE
const outputFileName = 'recruitmentStatusChanges - GL.csv'

const baseUrl = 'https://clinicaltrials.gov/ct2/history'


async function readStudyList() {
    const file = fs.createReadStream('nct numbers - GL.csv');
    var count = 0; // cache the running count


    return new Promise((resolve, reject) => {

        Papa.parse(file, {
            header: true,
            dynamicTyping: false,
            step: function (result) {
                let  nctNumber = result.data["NCT_ID"]
                studyIds.push(nctNumber.replace('NCT', ''))
            },
            complete: function (results, file) {
                console.log('Done parsing!');

                // scrapeRecruitmentStatus()
                resolve(studyIds)
            },
            error: function(e) {
                console.error(e)
            }
        });
    }
    )
}


async function scrapeRecruitmentStatus() {
    return new Promise(async (res, rej) => {
        let recruitmentChangesOutput = []
        for (let i = 0; i < studyIds.length; i++) {

            const nctNumber = studyIds[i]
            // Get the history HTML for the study
            const url = `${baseUrl}/NCT${nctNumber}`;
            try {
                const response = await axios.get(url);
                const $ = cheerio.load(response.data);
                // Find the table with submission histories
                const submissionsTable = $('tbody tr')
                // For each row get the submission date and any recruitment status changes
                for (let tableRowNumber = 0; tableRowNumber < submissionsTable.length; tableRowNumber++) {
                    const tableRow = cheerio.load(submissionsTable[tableRowNumber])
                    const dateRow = tableRow('td[headers=VersionDate] a')[0]
                    if (dateRow === undefined) {
                        continue
                    }
                    const submissionDate = tableRow('td[headers=VersionDate] a')[0].firstChild.data
                    const submissionURLSuffix = tableRow('td[headers=VersionDate] a')[0].attribs['href']
                    const submissionURL = `${url}${submissionURLSuffix}`
                    const recruitmentStatusSpan = tableRow('span.recruitmentStatus')

                    // Get the recruitment status
                    let recruitmentStatusText = 'No Change'
                    if (recruitmentStatusSpan.length > 0 && recruitmentStatusSpan[0].attribs['title'] !== undefined) {
                        // TODO: Could get fancy here and parse out the before and after and put into separate columns
                        recruitmentStatusText = recruitmentStatusSpan[0].attribs['title']
                    }

                    recruitmentChangesOutput.push({ 'NCT ID': `NCT${nctNumber}`, 'Submission Date': submissionDate, 'Recruitment Status': recruitmentStatusText, 'URL': submissionURL })
                }
            } catch (e) {
                console.error(`Shit's fucked ${url} - ${nctNumber} - I: ${i}`);
                console.error(e)
            }
        }
        // OPTION: could make one CSV per study by moving the next two lines up into the for loop and appending study id to file name (and clearing recruitmentChangesOutput variable after each write)
        const csv = Papa.unparse(recruitmentChangesOutput);
        fs.writeFile(outputFileName, csv, function (err) {
            if (err) return console.log(err);
            console.log(`Recruitment status file created: ${outputFileName}`);
            res()
        });
    })
}

async function mainThing() {
    let output = await readStudyList()
    await scrapeRecruitmentStatus()
    console.log("All Done")
}

const o = mainThing()

//scrapeRecruitmentStatus()