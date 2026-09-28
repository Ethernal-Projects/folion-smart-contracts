const fs = require('fs');
const path = require('path');

const encoding = 'utf-8'
const jsonIndent = 4
//const dir = path.join(__dirname, 'node_modules/@tokenysolutions/t-rex');
const contractsPath = path.join(__dirname, 'contracts/marketplace')
const buildInfoPath = path.join(__dirname, 'artifacts/build-info');

const contractsFiles = fs.readdirSync(contractsPath).filter(file => file.endsWith('.sol'))
const buildInfoJsonPath = path.join(buildInfoPath, fs.readdirSync(buildInfoPath).filter(file => file.endsWith('.json'))[0]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, encoding));
}

function writeJson(data, filePath) {
    fs.mkdirSync(`verification`, { recursive: true });
    fs.writeFileSync(`verification/${filePath}.json`, JSON.stringify(data, null, jsonIndent), encoding);
}

function getSources() {
    return readJson(buildInfoJsonPath).input.sources;
}

function getContracts() {
    return readJson(buildInfoJsonPath).output.contracts;
}

function createVerificationFiles() {
    const sources = getSources();
    const contracts = getContracts();
    
    Object.keys(contracts).forEach((key) => {
        const contractName = Object.keys(contracts[key])[0];
        
        if (contractsFiles.includes(`${contractName}.sol`)) {
            const metadata = JSON.parse(contracts[key][contractName].metadata);

            Object.keys(metadata.sources).forEach((contractPath) => {
                const contents = metadata.sources[contractPath];
                delete contents.urls;
                contents.content = sources[contractPath].content;
            });

            writeJson(metadata, contractName);
        }
    });
}

createVerificationFiles();