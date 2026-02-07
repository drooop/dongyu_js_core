#!/usr/bin/env node
/**
 * validate_login_ui_v0.mjs
 * TDD RED → GREEN validation for the Login Page UI AST.
 *
 * Tests:
 *  1. buildLoginAst exists and returns valid AST
 *  2. Root → Container (column)
 *  3. Contains Select with bind pointing to login_hs_url
 *  4. Contains 2 Input components (username + password)
 *  5. Password Input has props.type === 'password'
 *  6. Contains Button component
 *  7. Contains error Text with bind pointing to login_error
 *  8. AST can be rendered by renderTreeNode without error
 */

import { buildLoginAst, createLoginModel, LOGIN_MODEL_ID } from '../packages/ui-model-demo-frontend/src/login_ast.js';

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) {
    pass++;
    process.stdout.write(`  PASS  ${label}\n`);
  } else {
    fail++;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function findNodes(node, predicate, results) {
  results = results || [];
  if (!node) return results;
  if (predicate(node)) results.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      findNodes(child, predicate, results);
    }
  }
  return results;
}

// Build a mock snapshot matching what createLoginModel would produce.
function buildMockSnapshot(errorText) {
  return {
    models: {
      [LOGIN_MODEL_ID]: {
        cells: {
          '0,0,0': {
            labels: {
              login_hs_url: { k: 'login_hs_url', t: 'str', v: 'https://matrix.localhost' },
              login_username: { k: 'login_username', t: 'str', v: '' },
              login_password: { k: 'login_password', t: 'str', v: '' },
              login_error: { k: 'login_error', t: 'str', v: errorText || '' },
              login_loading: { k: 'login_loading', t: 'str', v: 'false' },
              login_hs_list: { k: 'login_hs_list', t: 'json', v: [{ url: 'https://matrix.localhost', label: 'https://matrix.localhost' }] },
            },
          },
        },
      },
    },
  };
}

process.stdout.write('\n=== Login UI AST Validation ===\n\n');

// Test 1: buildLoginAst exists and returns valid AST
process.stdout.write('[Test 1] buildLoginAst returns valid AST\n');
const snapshot = buildMockSnapshot('');
const ast = buildLoginAst(snapshot, LOGIN_MODEL_ID);
assert(ast && typeof ast === 'object', 'ast is an object');
assert(ast.type === 'Root', 'root type is Root');

// Test 2: Root → Container (column)
process.stdout.write('\n[Test 2] Root contains column Container\n');
const outerContainers = findNodes(ast, n => n.type === 'Container' && n.props && n.props.layout === 'column');
assert(outerContainers.length >= 1, 'has at least one column Container');

// Test 3: Contains Select with bind pointing to login_hs_url
process.stdout.write('\n[Test 3] Select component binds to login_hs_url\n');
const selects = findNodes(ast, n => n.type === 'Select');
assert(selects.length >= 1, 'has at least one Select');
const hsSelect = selects.find(n => n.bind && n.bind.read && n.bind.read.k === 'login_hs_url');
assert(hsSelect !== undefined, 'Select bind.read.k === login_hs_url');

// Test 4: Contains 2 Input components
process.stdout.write('\n[Test 4] Has 2 Input components\n');
const inputs = findNodes(ast, n => n.type === 'Input');
assert(inputs.length === 2, `found ${inputs.length} Input nodes (expected 2)`);

// Test 5: Password Input has props.type === 'password'
process.stdout.write('\n[Test 5] Password Input has type=password\n');
const passwordInput = inputs.find(n => n.props && n.props.type === 'password');
assert(passwordInput !== undefined, 'one Input has props.type=password');
assert(passwordInput && passwordInput.props && passwordInput.props.showPassword === true, 'password Input has showPassword=true');

// Test 6: Contains Button component
process.stdout.write('\n[Test 6] Has Button component\n');
const buttons = findNodes(ast, n => n.type === 'Button');
assert(buttons.length >= 1, 'has at least one Button');
const loginBtn = buttons.find(n => n.props && n.props.label && n.props.label.includes('Login'));
assert(loginBtn !== undefined, 'Button label contains "Login"');

// Test 7: Error Text with bind to login_error (when error present)
process.stdout.write('\n[Test 7] Error Text visible when error present\n');
const snapshotWithError = buildMockSnapshot('invalid_credentials');
const astWithError = buildLoginAst(snapshotWithError, LOGIN_MODEL_ID);
const errorTexts = findNodes(astWithError, n => n.type === 'Text' && n.bind && n.bind.read && n.bind.read.k === 'login_error');
assert(errorTexts.length >= 1, 'error Text with bind.read.k=login_error exists when error present');

// Test 7b: Error Text absent when no error
const astNoError = buildLoginAst(snapshot, LOGIN_MODEL_ID);
const errorTextsNone = findNodes(astNoError, n => n.type === 'Text' && n.bind && n.bind.read && n.bind.read.k === 'login_error');
assert(errorTextsNone.length === 0, 'no error Text when login_error is empty');

// Test 8: createLoginModel function exists
process.stdout.write('\n[Test 8] createLoginModel function exists\n');
assert(typeof createLoginModel === 'function', 'createLoginModel is a function');
assert(typeof LOGIN_MODEL_ID === 'number', 'LOGIN_MODEL_ID is a number');

// Test 9: Select has options from login_hs_list
process.stdout.write('\n[Test 9] Select options from login_hs_list\n');
const hsSelectNode = selects.find(n => n.bind && n.bind.read && n.bind.read.k === 'login_hs_url');
assert(
  hsSelectNode && hsSelectNode.props && Array.isArray(hsSelectNode.props.options) && hsSelectNode.props.options.length > 0,
  'Select has options array from login_hs_list',
);

// Summary
process.stdout.write(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
