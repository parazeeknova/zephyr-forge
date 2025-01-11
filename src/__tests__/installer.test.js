import { jest, expect, test, describe, beforeEach,afterEach } from '@jest/globals';
import '@testing-library/jest-dom';
import { JSDOM } from 'jsdom';

describe('Installer Client Script', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="toast"></div>
          <div class="status-indicator">
            <div class="status-dot"></div>
            <span class="status-text"></span>
          </div>
          <div class="command-wrapper" data-command="unix">
            <span class="command">curl example.com</span>
            <button class="copy-button">copy</button>
          </div>
          <div class="command-wrapper" data-command="windows">
            <span class="command">powershell example.com</span>
            <button class="copy-button">copy</button>
          </div>
        </body>
      </html>
    `);

        window = dom.window;
        document = window.document;

        window.SERVER_CONFIG = {    
            API_BASE: 'http://localhost:3000/api',
            STATUS_INTERVAL: 1000,
            COPY_TIMEOUT: 500,
            TOAST_DURATION: 1000
        };

        window.navigator.clipboard = {
            writeText: jest.fn()
        };

        global.fetch = jest.fn().mockImplementation((url) => {
            if (url.includes('/status')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        status: 'operational',
                        environment: 'development'
                    })
                });
            }
            if (url.includes('/copy-count')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ count: 1 })
                });
            }
            return Promise.reject(new Error('Not found'));
        });
    });
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('Toast Functionality', () => {
    test('shows toast message with correct duration', () => {
        const showToast = require('../public/installer').showToast;
        const toast = document.getElementById('toast');

        showToast('Test message');

        expect(toast.textContent).toBe('Test message');
        expect(toast.classList.contains('show')).toBeTruthy();

        jest.advanceTimersByTime(window.SERVER_CONFIG.TOAST_DURATION);
        expect(toast.classList.contains('show')).toBeFalsy();
    });

    test('handles error toast messages', () => {
        const showToast = require('../public/installer').showToast;
        const toast = document.getElementById('toast');

        showToast('Error message', true);

        expect(toast.classList.contains('error')).toBeTruthy();
    });
});

describe('Status Checker', () => {
    test('updates status indicators when system is operational', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'operational' })
        });

        const checkStatus = require('../public/installer').checkStatus;
        await checkStatus();

        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        expect(statusDot.classList.contains('operational')).toBeTruthy();
        expect(statusText.textContent).toBe('System Operational');
    });

    test('handles error states correctly', async () => {
        global.fetch.mockRejectedValueOnce(new Error('API Error'));

        const checkStatus = require('../public/installer').checkStatus;
        await checkStatus();

        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        expect(statusDot.classList.contains('error')).toBeTruthy();
        expect(statusText.textContent).toBe('System Error');
    });
});

describe('Copy Counter', () => {
    test('updates copy count after successful copy', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ count: 42 })
        });

        const updateCopyCount = require('../public/installer').updateCopyCount;
        await updateCopyCount('unix');

        const countElement = document.querySelector('[data-command="unix"] .copy-count');
        expect(countElement.textContent).toBe('(42)');
    });

    test('handles copy count errors gracefully', async () => {
        global.fetch.mockRejectedValueOnce(new Error('API Error'));
        const consoleSpy = jest.spyOn(console, 'error');

        const updateCopyCount = require('../public/installer').updateCopyCount;
        await updateCopyCount('unix');

        expect(consoleSpy).toHaveBeenCalled();
    });
});

describe('Command Copy Functionality', () => {
    test('copies command and shows success message', async () => {
        const wrapper = document.querySelector('[data-command="unix"]');
        const copyCommand = require('../public/installer').copyCommand;

        await copyCommand(wrapper);

        expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('curl example.com');
        expect(wrapper.classList.contains('copied')).toBeTruthy();
    });

    test('handles copy failures', async () => {
        window.navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Copy failed'));
        const wrapper = document.querySelector('[data-command="unix"]');
        const copyCommand = require('../public/installer').copyCommand;

        await copyCommand(wrapper);

        const toast = document.getElementById('toast');
        expect(toast.classList.contains('error')).toBeTruthy();
    });
});
