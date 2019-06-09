#!/usr/bin/env node

const util = require('util');
const http = require('https');
const fs = require('fs');
const rimraf = require("rimraf");
const exec = util.promisify(require('child_process').exec);

const payload = require('./payload-example.json')

async function shell(command) {
  console.log('Running: "' + command + '"');
  const { stdout, stderr } = await exec(command);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
}

function download(url, filename){
  const file = fs.createWriteStream(filename);
  const request = http.get(url, function(response) {
    response.pipe(file);
  });
}

async function ensureDir (dirpath) {
  try {
    await fs.mkdir(dirpath, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

async function main(payload, done){

  // create temporary folder
  const tmpFolder = __dirname + '/tmp';
  // TODO replace in async
  fs.existsSync(tmpFolder) || fs.mkdirSync(tmpFolder);
  // Download the files
  payload.files.forEach((file) => {
    download(file.url, tmpFolder + '/' + file.name)
  })

  if(payload.action === 'zip'){
    shell('docker run --rm zipper \
    -v ' + tmpFolder + ':/files \
    zipper "$@" \
    ' + payload.args.join(' ')
    )
    .then(() => {

      // TODO Upload new files (or let the action to it?)

      //  delete the temporary folder
      rimraf(tmpFolder, () => {
        done();
        console.log("done");
      });
    })
    .catch((err) => {
      console.log(err);
      //  delete the temporary folder
      rimraf(tmpFolder, () => {
        done();
        console.log("done");
      });
     });
  }

}

main(payload)

module.exports.run = main
