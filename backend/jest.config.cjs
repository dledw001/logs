module.exports =  {
    testEnvironment: "node",
    transform: {},
    verbose: true,
    setupFiles: ['<rootDir>/test/setup-env.js'],
    setupFilesAfterEnv: ['<rootDir>/test/setup-teardown.js'],
};
