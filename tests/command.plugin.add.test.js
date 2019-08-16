const AddCommand = require('../src/commands/plugin/add');
const appDir = require('../src/ta-util').appDir;
const fs = require('fs');

test('it checks that action is valid', async () => {
    const addCommand = new AddCommand();
    const action = 'slice';
    const type = 'docker';
    const actionIsValid = await addCommand.isActionValid(
        action,
        type,
        appDir + '/tests/actions.json'
    );
    expect(actionIsValid).toBe(true);
});

test('it checks that action is not valid', async () => {
    const addCommand = new AddCommand();
    const action = 'unzip';
    const type = 'docker';
    const actionIsValid = await addCommand.isActionValid(
        action,
        type,
        appDir + '/tests/actions.json'
    );
    expect(actionIsValid).toBe(false);
});

test('it checks that path is valid', async () => {
    const addCommand = new AddCommand();
    const actionPath = appDir + '/actions/unzip';
    const pathIsValid = await addCommand.isPathValid(actionPath);
    expect(pathIsValid).toBe(true);
});

test('it checks that path is not valid', async () => {
    const addCommand = new AddCommand();
    const actionPath = appDir + '/actions/slice';
    await expect(addCommand.isPathValid(actionPath)).rejects.toThrow(
        'ENOENT: no such file or directory, stat \'' + appDir + '/actions/slice\''
    );
});

test('it adds an action to the action list', async () => {
    const addCommand = new AddCommand();
    const action = 'slice';
    const type = 'docker';
    const actionListExpected = {
        zip: {
            type: 'docker',
            url: 'file:./actions/zip'
        },
        unzip: {
            type: 'native',
            url: 'file:./actions/unzip'
        },
        slice: {
            type: 'docker'
        }
    };
    await addCommand.addActionToActionsList(
        action,
        type,
        appDir + '/tests/actions.json'
    );
    const data = await fs.promises.readFile(appDir + '/tests/actions.json');
    const actions = JSON.parse(data);
    expect(actions).toEqual(actionListExpected);
});
