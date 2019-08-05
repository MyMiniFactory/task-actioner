const actioner = require('../actioner');
const uniqueString = require('unique-string');
const fs = require('fs');

test('it creates a workspace with input and output folder and a results.json file', () => {
    const randomString = uniqueString();
    const outputFiles = {
        output: {
            location: '/',
            name: 'result.zip'
        }
    };
    return actioner.createWorkspace(randomString, outputFiles).then(workspace => {
        expect(
            fs.lstatSync(workspace + '/input').isDirectory() &&
                fs.lstatSync(workspace + '/output').isDirectory() && fs.lstatSync(workspace + '/results.json').isFile()
        ).toBe(true);
    });
});

test('it gets "docker" as an action type', () => {
    return actioner.getActionType('zip').then(type => {
        expect(type).toBe('docker');
    });
});
