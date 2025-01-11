import { jest, expect, test, describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';
import { JSDOM } from 'jsdom';

global.jest = jest;
global.expect = expect;
global.test = test;
global.describe = describe;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.beforeEach = beforeEach;
global.afterEach = afterEach;

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

jest.useFakeTimers();
console.error = jest.fn();
