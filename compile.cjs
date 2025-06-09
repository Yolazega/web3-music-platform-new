const path = require('path');
const fs = require('fs');
const solc = require('solc');

const contractPath = path.resolve(__dirname, 'src', 'contracts', 'AxepVoting_Simple.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'AxepVoting_Simple.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*'],
            },
        },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for compilation errors
if (output.errors) {
    console.error('Compilation errors:');
    let hasErrors = false;
    output.errors.forEach((err) => {
        // We only want to stop for errors, not warnings
        if (err.severity === 'error') {
            console.error(err.formattedMessage);
            hasErrors = true;
        } else {
            console.warn(err.formattedMessage);
        }
    });
    if (hasErrors) {
        process.exit(1);
    }
}

const contract = output.contracts['AxepVoting_Simple.sol']['AxepVoting'];

if (!contract) {
    console.error('Compilation failed. Contract not found.');
    console.log('Compiler output:', output);
    process.exit(1);
}


const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

const abiPath = path.resolve(__dirname, 'src', 'contracts', 'AxepVoting_Simple.json');

fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));

console.log('Contract compiled successfully!');
console.log('ABI saved to:', abiPath); 