import { jest, expect, test, describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';

global.jest = jest;
global.expect = expect;
global.test = test;
global.describe = describe;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.beforeEach = beforeEach;
global.afterEach = afterEach;

jest.useFakeTimers();
