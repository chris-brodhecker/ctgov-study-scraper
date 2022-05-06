const axios = require('axios');
const cheerio = require('cheerio');
const Papa = require('papaparse')
const fs = require('fs');
const { resolve } = require('path');
const { rejects } = require('assert');

// CHANGE THESE STUDY IDS TO WHAT YOU WANT
const projectIds = ['61f0596e50d76']
// THIS IS THE FILE
const outputFileName = 'elucidatData.csv'

const baseUrl = 'https://app.elucidat.com/analyse/get_learner_data'

const resultsPerPage = 100

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


function appendProjectId(projectId, jsonObject) {
    const newJson = {
        ...jsonObject,
        'projectId': projectId
    }

    return newJson
}

async function makeLearnerDataRequest(projectId, startAt) {
    // Get the history HTML for the study
    return new Promise(async (resolve, reject) => {
        const url = `${baseUrl}/${projectId}?skip=${startAt}&per_page=${resultsPerPage}`;
        try {
            const response = await axios.get(url,
                {
                    headers: {
                        Cookie: "__zlcmid=19gkseYPC5VxYcu; ajs_user_id=33530; ajs_anonymous_id=4ba5bc23-e156-48e5-885f-d2fe6349aae3; ajs_group_id=14257; intercom-id-faa870c3d5130b707e79ad6d32c778d107a0443e=7d1a10ba-3e40-496e-8ff3-949089582e3c; author_session=PykSN66ory0bsa52dfR9EoboaAbV9Tt4tCOIA5RRDvCHlLboE9ptgXWpB7G6rIVrQUgW1DxcE6zT34E%2F2yEB1RVGesfePYWGqprmiCRTlPMJTkkEKFCY9i64Z8ochNSHxQBsaTNsK1c%2BJD8f8HuHyMsgewUgcRljr%2BBeFlyXBUT8sbujTU%2BUW3FyAyfdWe9MF%2BxUysyW3BzQp37AHHXkVpJx99JKYn2VPWihdfv1yUe3Ejh0p%2FQLawd1t01Z941V2TN2zSOg4eeN8xaYLF%2Brl6sNR0IvrKMeDnOWntGVZ4J%2B1N0YyKVloDhWSshWjfdInKOTF8lK0oS9tOgSgpCkxZZoyhBqW38YZgwhW8uFxjK99kwvCnYw%2BwlBFBHOgGqy8BbNnNswoFVn%2B8EyYioOpI7BX62LaoNPMbhdM%2B2SmHhXNtQs7WM%2FTF%2Fuk%2BmhwN5WxH9pNKdOfz8Eq6qwCI2aMA%3D%3D; assets_token=e54f81f0260f5cbc0382bbac710558a82c9dde44; jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJqdGkiOiI3ZGVmYWYxNzZjMGRiNmM4MTEyMSIsInBheWxvYWQiOnsiZW52IjoicHJvZCIsInVzZXIiOnsiaWQiOjMzNTMwLCJhZGRlZCI6IjIwMjAtMDktMjQgMTM6NDU6MDMiLCJhY3RpdmF0ZWQiOnRydWUsImFjY291bnRfaWQiOjE0MjU3LCJhY2NvdW50X2NoYW1waW9uIjpmYWxzZSwiZW1haWwiOiJDaHJpc19Ccm9kaGVja2VyQG1ja2luc2V5LmNvbSIsImZpcnN0X25hbWUiOiJDaHJpcyIsImxhc3RfbmFtZSI6IkJyb2RoZWNrZXIiLCJsYW5nIjoiZW4tVVMiLCJtdWx0aXBsZV9yb2xlcyI6ZmFsc2UsImF1dGhfdHlwZSI6eyJ0eXBlIjoidXNlcm5hbWUiLCJkYXRhIjpbXX0sInByb2plY3RfYWNjZXNzX3Njb3BlIjoiYWNjb3VudCIsInN1cGVydXNlcl9sZXZlbCI6Im5vbmUiLCJ2aWV3X3BpX2xlYXJuZXJfZGF0YSI6dHJ1ZSwicGFydG5lcl9hY2NvdW50X2FjY2Vzc19zY29wZSI6Im5vbmUiLCJwYXJ0bmVyX3N1cGVyX3VzZXJfbGV2ZWwiOm51bGwsIm9uYm9hcmRpbmciOmZhbHNlfSwiaW50ZXJjb20iOlsxNjUxODU4MjA3LDM5LG51bGwsIjYwMDFiZTZhMjJlNTIyZGExNjA5YWNiZWNjOTZkMjdiMzFiZDJkNjU1YzE2ZmQ2YWE1M2I1NzVmNjY1MWJiOTAiXSwiYWNjb3VudCI6eyJpZCI6MTQyNTcsImFjY291bnRfbmFtZSI6Ik1jS2luc2V5ICYgQ29tcGFueSIsImFjY291bnRfc3RhdHVzIjoicGFpZF9hY2NvdW50IiwiZnJlZV90cmlhbF9lbmRfZGF0ZSI6IjIwMTktMDctMjUgMDA6MDA6MDAiLCJjdXJyZW50X3Rlcm1fc3RhcnRfZGF0ZSI6IjIwMjEtMTAtMTkgMDA6MDA6MDAiLCJiaWxsaW5nX2Fubml2ZXJzYXJ5IjoiMjAyMi0xMC0xOCIsInJlbmV3YWxfZGF0ZSI6IjIwMjItMTAtMTggMDA6MDA6MDAiLCJjdXJyZW50X3Rlcm1fZW5kX2RhdGUiOiIyMDIyLTEwLTE4IDAwOjAwOjAwIiwic3Vic2NyaXB0aW9uX3N0YXJ0X2RhdGUiOm51bGwsInVzZXJfY29kZSI6IjVjNTMxZTY1MTZlYzYiLCJsb2dvX2ZpbGUiOm51bGwsImxvZ29fZmlsZV9wYXRoX3BhcmFtcyI6W10sIm93bmVyIjp7ImlkIjoyNDU4NCwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJXZWRlbWV5ZXIiLCJlbWFpbCI6ImpvaG5fd2VkZW1leWVyQG1ja2luc2V5LmNvbSJ9LCJyZXNlbGxlciI6ZmFsc2UsInByaWNpbmdfdGllciI6InNjYWxlIiwidXNlcl9yb2xlX2xpbWl0IjoxNX0sInByaXZpbGVnZXMiOnsiYWNjb3VudCI6eyJlbmFibGVfYW5hbHl0aWNzX2Rvd25sb2FkIjp0cnVlLCJlbmFibGVfYW5hbHl0aWNzIjp0cnVlLCJlbmFibGVfYXBpIjp0cnVlLCJlbmFibGVfYXNzZXRfbGlicmFyeV9zdGFuZGFsb25lIjp0cnVlLCJlbmFibGVfYXNzZXRfbGlicmFyeSI6dHJ1ZSwiZW5hYmxlX2NvbW1lbnRpbmciOnRydWUsImVuYWJsZV9jb250cm9sX2RvY3VtZW50cyI6ZmFsc2UsImVuYWJsZV9kYXRhX2R1bXAiOmZhbHNlLCJlbmFibGVfZGVwYXJ0bWVudHMiOnRydWUsImVuYWJsZV9lbmNyeXB0aW9uIjp0cnVlLCJlbmFibGVfaWZyYW1lcyI6ZmFsc2UsImVuYWJsZV9sYXlvdXRfZGVzaWduZXIiOnRydWUsImVuYWJsZV9sZWdhY3lfdGhlbWVzIjpmYWxzZSwiZW5hYmxlX21hc3Rlcl9jb3Vyc2VfcmVsZWFzZSI6dHJ1ZSwiZW5hYmxlX21hc3Rlcl9tb2R1bGVzIjpmYWxzZSwiZW5hYmxlX25hdGl2ZV9hcHBzIjp0cnVlLCJlbmFibGVfcGFydHNfdGhlbWVzIjp0cnVlLCJlbmFibGVfcGVyc29uYWxpc2F0aW9uIjpmYWxzZSwiZW5hYmxlX3JlbGVhc2VfZG93bmxvYWQiOnRydWUsImVuYWJsZV9yZWxlYXNlX2Rvd25sb2FkX2NvbXBsZXRlIjp0cnVlLCJlbmFibGVfcmVsZWFzZXMiOnRydWUsImVuYWJsZV9zdWNjZXNzX2ZhY3RvcnNfc3VwcG9ydCI6dHJ1ZSwiZW5hYmxlX3RlbXBsYXRlcyI6dHJ1ZSwiZW5hYmxlX3RoZW1lX2VkaXRvcl9wYXJ0cyI6ZmFsc2UsImVuYWJsZV90aGVtZV9lZGl0b3IiOmZhbHNlLCJlbmFibGVfdHJhbnNsYXRpb24iOnRydWUsImVuYWJsZV91c2VyX3JvbGVzIjp0cnVlLCJlbmFibGVfdmFyaWF0aW9uc19tYW5hZ2VyIjp0cnVlLCJlbmFibGVfd2hpdGVsYWJlbCI6dHJ1ZSwiZW5hYmxlX3ByaW9yaXR5X3N1cHBvcnQiOmZhbHNlLCJlbmFibGVfc3RhcnRfZnJvbV9sZWdhY3lfdGhlbWVzIjpmYWxzZSwiZW5hYmxlX2xhdW5jaHBhZCI6dHJ1ZSwiZW5hYmxlX2Nob29zZV9vZmZsaW5lX3Njb3JtX3ZpZGVvX3F1YWxpdHkiOmZhbHNlLCJlbmFibGVfYWNjZWxlcmF0b3JfdGFzdGVyIjpmYWxzZSwiZW5hYmxlX2FjY2VsZXJhdG9yX2Z1bGwiOnRydWUsImVuYWJsZV9hZHZhbmNlZF91c2VyX21hbmFnZW1lbnQiOnRydWUsImVuYWJsZV9sZWFybmluZ19odWIiOnRydWUsImVuYWJsZV9zZWN1cmVfY2RuIjp0cnVlLCJlbmFibGVfcHJvamVjdF9wcml2YXRlX2ZpbGVfdXBsb2FkIjpmYWxzZSwiZW5hYmxlX2xvZ2luIjp0cnVlLCJlbmFibGVfZWRpdGluZyI6dHJ1ZSwiZW5hYmxlX3Jldmlld2luZyI6dHJ1ZSwiZW5hYmxlX2NvdXJzZV92aWV3cyI6dHJ1ZX0sImRlcGFydG1lbnRzIjpbXX19LCJpc3MiOiJpZCIsImlhdCI6MTY1MTg1ODgxMy44MjIwODIsIm5iZiI6MTY1MTg1ODgxMy44MjIwODIsImV4cCI6MTY1MjExODAxMy44MjIwNjZ9.fP3wfMyvzh8acijsnyTP_b2spZI0lCYNZsBNL-9UhxjjZ0tmEf89OfpuYo5ZmZlTrHweuRjpEmw7tCjSwu6UBQ; jwt-refresh=538ea53910a296fc1e43; intercom-session-faa870c3d5130b707e79ad6d32c778d107a0443e=SUFtZlhDaWpER2s2b1FTTmhWK00vNkY5LzFrMStITTBHZXNLRVFoVmJhZm81QXlPYlJUbk9VUUVQVnRZeGlLbi0tSkI4VHJmMFNiWERuaU93bUlPQ1hyZz09--70f0ec8215afe5bb56b6958d13a8e91f2a8ea1eb"
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

async function mainThing() {
    // let output = await readStudyList()
    await scrapeLearnerData()
    console.log("All Done")
}

const o = mainThing()

//scrapeRecruitmentStatus()