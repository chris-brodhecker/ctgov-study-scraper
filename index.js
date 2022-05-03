const axios = require('axios');
const cheerio = require('cheerio');
const Papa = require('papaparse')
const fs = require('fs');

const studyIds = ['04404192']
const baseUrl = 'https://clinicaltrials.gov/ct2/history'
const outputFileName = 'recruitmentStatusChanges.csv'

let recruitmentChangesOutput = []
for (let i = 0; i< studyIds.length; i++) {
(async () => {
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
        const submissionDate = tableRow('td[headers=VersionDate] a')[0].firstChild.data
        const recruitmentStatusSpan = tableRow('span.recruitmentStatus')

        // Get the recruitment status
        let recruitmentStatusText = 'No Change'
        if (recruitmentStatusSpan.length > 0 && recruitmentStatusSpan[0].attribs['title'] !== undefined) {
            // TODO: Could get fancy here and parse out the before and after and put into separate columns
            recruitmentStatusText = recruitmentStatusSpan[0].attribs['title']
        }
        
        recruitmentChangesOutput.push({'study': nctNumber, 'Submission Date': submissionDate, 'Recruitment Status': recruitmentStatusText})
    }
    

    // OPTION: could make one CSV per study by moving the next two lines up into the for loop and appending study id to file name (and clearing recruitmentChangesOutput variable after each write)
    const csv = Papa.unparse(recruitmentChangesOutput);    
    fs.writeFile(outputFileName, csv, function (err) {
        if (err) return console.log(err);
        console.log(`Recruitment status file created: ${outputFileName}`);
      });

  } catch (e) {
    console.error(`Shit's fucked ${url} - ${nctNumber} - I: ${i}`);
    console.error(e)
  }
})();

}