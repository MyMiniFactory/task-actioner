const actioner = require('../actioner');
const uniqueString = require('unique-string');
const fs = require('fs');

test('it creates a workspace with input and output folder', () => {
    const randomString = uniqueString();
    return actioner.createWorkspace(randomString).then(workspace => {
        expect(
            fs.lstatSync(workspace + '/input').isDirectory() &&
                fs.lstatSync(workspace + '/output').isDirectory()
        ).toBe(true);
    });
});

test('it gets "docker" as an action type', () => {
    return actioner.getActionType('zip').then(type => {
        expect(type).toBe('docker');
    });
});
