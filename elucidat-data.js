const axios = require('axios');
const cheerio = require('cheerio');
const Papa = require('papaparse')
const fs = require('fs');
const secrets = require('./secrets')

// CHANGE THESE STUDY IDS TO WHAT YOU WANT
const projectIds = ['61f0596e50d76']
const folderIds = ['59365']
// THIS IS THE FILE
const outputFileName = 'elucidatData.csv'
const elucidatProjectsOutputFileName = 'elucidatProjects.csv'


const resultsPerPage = 100

console.log(secrets)
// async function readStudyList() {
//     const file = fs.createReadStream('nct numbers - GL.csv');
//     var count = 0; // cache the running count


//     return new Promise((resolve, reject) => {

//         Papa.parse(file, {
//             header: true,
//             dynamicTyping: false,
//             step: function (result) {
//                 let  nctNumber = result.data["NCT_ID"]
//                 studyIds.push(nctNumber.replace('NCT', ''))
//             },
//             complete: function (results, file) {
//                 console.log('Done parsing!');

//                 // scrapeRecruitmentStatus()
//                 resolve(studyIds)
//             },
//             error: function(e) {
//                 console.error(e)
//             }
//         });
//     }
//     )
// }


async function getLearnerDataFromJSVariable(text, variableName) {
    return new Promise((res, rej) => {
        try {
            const formattedVariableName = `var ${variableName} =`
            const chopFront = text.substring(text.search(formattedVariableName) + formattedVariableName.length, text.length);
            const JSONOnly = chopFront.substring(0, chopFront.search(";"));
            const parsedJSON = JSON.parse(JSONOnly);
            res(parsedJSON)
        } catch (e) {
            rej(e)
        }
    })
}


async function scrapeLearnerData() {
    return new Promise(async (res, rej) => {
        let allLearnerData = []
        for (let i = 0; i < projectIds.length; i++) {

            try {
                const projectId = projectIds[i]
                let totalRecords;
                let startAt = 0;
                while (totalRecords === undefined || startAt < totalRecords) {
                    const pageOfLearnerData = await makeLearnerDataRequest(projectId, startAt)
                    totalRecords = pageOfLearnerData.total
                    startAt = pageOfLearnerData.to


                    // Add everything to the main array
                    pageOfLearnerData.results.forEach(d => {
                        const enrichedData = appendProjectId(projectId, d)
                        allLearnerData.push(enrichedData)
                    }
                    )
                }

            } catch (e) {
                console.error(`Shit's fucked ${url} - ${projectId} - I: ${i}`);
                console.error(e)
            }
        }
        // OPTION: could make one CSV per study by moving the next two lines up into the for loop and appending study id to file name (and clearing recruitmentChangesOutput variable after each write)
        const csv = Papa.unparse(allLearnerData);
        fs.writeFile(outputFileName, csv, function (err) {
            if (err) return console.log(err);
            console.log(`Recruitment status file created: ${outputFileName}`);
            res()
        });
    })
}

async function makeLearnerDataRequest(projectId, startAt) {
    const baseUrl = 'https://app.elucidat.com/analyse/get_learner_data'
    // Get the history HTML for the study
    return new Promise(async (resolve, reject) => {
        const url = `${baseUrl}/${projectId}?skip=${startAt}&per_page=${resultsPerPage}`;
        try {
            const response = await axios.get(url,
                {
                    headers: {
                        Cookie: secrets.elucidat.cookie
                    }
                });

            const $ = cheerio.load(response.data);
            const scriptText = $('script')[0].firstChild.data
            const learner_data = await getLearnerDataFromJSVariable(scriptText, "upload_data");
            resolve(learner_data)
        } catch (e) {
            reject(e)
        }
    })
}


function appendProjectId(projectId, jsonObject) {
    const newJson = {
        ...jsonObject,
        'projectId': projectId
    }

    return newJson
}


async function makeElucidatProjectDataRequest(folderId, startAt) {
    const url = 'https://app.elucidat.com/projects/'
    const per_page = 100
    const skip = startAt
    return new Promise(async (resolve, reject) => {
        try {


            const response = await axios.post(
                'https://app.elucidat.com/projects/',
                new URLSearchParams({
                    'action': 'filter',
                    'project_type': 'all',
                    'filter': '',
                    'show': 'all',
                    'folders': folderId,
                    'order': 'alpha',
                    skip,
                    per_page
                }),
                {
                    headers: {
                        'cookie': secrets.elucidat.cookie,
                        'authorization': secrets.elucidat.authorization,
                        'authority': 'app.elucidat.com',
                        'accept': '*/*',
                        'accept-language': 'en-US,en;q=0.9,vi-VN;q=0.8,vi;q=0.7',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'origin': 'https://app.elucidat.com',
                        'referer': 'https://app.elucidat.com/projects',
                        'x-requested-with': 'XMLHttpRequest'
                    }
                }
            );

            resolve(response.data)
        } catch (e) {
            reject(e)
        }
    })
}

async function getElucidatProjectData(folderIds) {
    return new Promise(async (res, rej) => {
        let allProjectData = []
        for (let i = 0; i < folderIds.length; i++) {

            try {
                const folderId = folderIds[i]
                let totalRecords;
                let startAt = 0;
                while (totalRecords === undefined || startAt < totalRecords) {
                    const pageofProjectData = await makeElucidatProjectDataRequest(folderId, startAt)
                    totalRecords = pageofProjectData.total
                    startAt = pageofProjectData.to


                    // Add everything to the main array (could be more efficient since we don't need to modify it like we do in learner data)
                    pageofProjectData.results.forEach(d => {
                        allProjectData.push(d)
                    }
                    )
                }

            } catch (e) {
                console.error(`Shit's fucked - ${folderId} - I: ${i}`);
                console.error(e)
            }
        }
        // OPTION: could make one CSV per study by moving the next two lines up into the for loop and appending study id to file name (and clearing recruitmentChangesOutput variable after each write)
        const csv = Papa.unparse(allProjectData);
        fs.writeFile(elucidatProjectsOutputFileName, csv, function (err) {
            if (err) return console.log(err);
            console.log(`Elucidat project file created: ${elucidatProjectsOutputFileName}`);
            res()
        });
    })
}

async function mainThing() {
    // let output = await readStudyList()
    // await scrapeLearnerData()
    await getElucidatProjectData(folderIds)
    
    console.log("All Done")
}

const o = mainThing()

//scrapeRecruitmentStatus()