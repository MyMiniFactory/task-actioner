const actioner = require('../actioner');
const fs = require('fs');

test('it creates a workspace with input and output folder and a results.json file', () => {
    const outputFiles = {
        output: {
            location: '/',
            name: 'result.zip'
        }
    };
    return actioner.createWorkspace(outputFiles).then(workspace => {
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
