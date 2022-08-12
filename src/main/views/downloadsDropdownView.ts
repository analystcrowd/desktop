// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';

import log from 'electron-log';

import {CombinedConfig, DownloadItems} from 'types/config';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_DOWNLOADS_DROPDOWN,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';
import {TAB_BAR_HEIGHT, DOWNLOADS_DROPDOWN_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT, TAB_BAR_PADDING} from 'common/utils/constants';
import {getLocalPreload, getLocalURLString} from 'main/utils';

import WindowManager from '../windows/windowManager';

export default class DownloadsDropdownView {
    view: BrowserView;
    bounds?: Electron.Rectangle;
    downloads: DownloadItems;
    darkMode: boolean;
    window: BrowserWindow;
    windowBounds: Electron.Rectangle;
    isOpen: boolean;
    mainWindowWidth: number;

    constructor(window: BrowserWindow, downloads: DownloadItems, darkMode: boolean, mainWindowWidth: number) {
        this.downloads = downloads;
        this.window = window;
        this.darkMode = darkMode;
        this.isOpen = false;
        this.mainWindowWidth = mainWindowWidth;
        this.bounds = this.getBounds(DOWNLOADS_DROPDOWN_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT);

        this.windowBounds = this.window.getContentBounds();

        const preload = getLocalPreload('downloadsDropdown.js');
        this.view = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: false,
        }});

        this.view.webContents.loadURL(getLocalURLString('downloadsDropdown.html'));
        this.window.addBrowserView(this.view);

        this.view.webContents.on('did-fail-load', (msg, ...rest) => log.error(msg, rest))

        ipcMain.on(OPEN_DOWNLOADS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_DOWNLOADS_DROPDOWN, this.handleClose);
        ipcMain.on(EMIT_CONFIGURATION, this.updateConfig);
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        log.silly('DownloadsDropdownView.config', {config});

        this.downloads = config.downloads;
        this.darkMode = config.darkMode;
        this.updateDownloadsDropdown();
    }

    updateWindowBounds = () => {
        this.windowBounds = this.window.getContentBounds();
        this.updateDownloadsDropdown();
    }

    updateDownloadsDropdown = () => {
        log.silly('DownloadsDropdownView.updateDownloadsDropdown');

        this.view.webContents.send(
            UPDATE_DOWNLOADS_DROPDOWN,
            this.downloads,
            this.darkMode,
            this.windowBounds,
        );
    }

    handleOpen = () => {
        log.debug('DownloadsDropdownView.handleOpen');
        
        if (!this.bounds) {
            return;
        }
        
        this.view.setBounds(this.bounds);
        this.window.setTopBrowserView(this.view);
        this.view.webContents.focus();
        WindowManager.sendToRenderer(OPEN_DOWNLOADS_DROPDOWN);
        this.isOpen = true;
    }

    handleClose = () => {
        log.debug('DownloadsDropdownView.handleClose');

        this.view.setBounds(this.getBounds(0, 0));
        WindowManager.sendToRenderer(CLOSE_DOWNLOADS_DROPDOWN);
        this.isOpen = false;
    }

    getBounds = (width: number, height: number) => {
        return {
            x: this.getX(this.mainWindowWidth),
            y: this.getY(),
            width,
            height,
        };
    }

    getX = (mainWidth: number) => {
        const result = mainWidth - DOWNLOADS_DROPDOWN_WIDTH - TAB_BAR_PADDING;
        if (result <= DOWNLOADS_DROPDOWN_WIDTH) return 0;
        return result;
    }

    getY = () => {
        return TAB_BAR_HEIGHT;
    }

    destroy = () => {
        // workaround to eliminate zombie processes
        // https://github.com/mattermost/desktop/pull/1519
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.view.webContents.destroy();
    }
}