// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import svg2img from 'svg2img';   // svg files to image buffer
import jsQR from 'jsqr';         // qr image decoder
import { ErrorCode } from './error';
import Log from './logger';
import { FileInfo } from './file';
import * as qr from './qr';
import { PNG } from 'pngjs';
import fs from 'fs';
import Jimp from 'jimp';
import { toFile, QRCodeSegment } from 'qrcode';


export async function validate(images: FileInfo[]): Promise<{ result: JWS | undefined, log: Log }> {

    const log = new Log(
        images.length > 1 ?
            'QR images (' + images.length.toString() + ')' :
            'QR image');


    const shcStrings: SHC[] = [];

    for (let i = 0; i < images.length; i++) {
        const shc = await decode(images[i], log);
        if (shc === undefined) return { result: undefined, log: log };
        shcStrings.push(shc);
        log.info(images[i].name + " decoded");
        log.debug(images[i].name + ' = ' + shc);
    }


    log.child = (await qr.validate(shcStrings)).log;


    return { result: JSON.stringify(shcStrings), log: log };
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo, log: Log): Promise<string | undefined> {

    let svgBuffer;

    switch (fileInfo.fileType) {

        case 'svg':
            svgBuffer = await svgToImageBuffer(fileInfo.buffer.toString(), log);
            fileInfo.image = PNG.sync.read(svgBuffer);
            fs.writeFileSync(fileInfo.path + '.png', svgBuffer);

        // eslint-disable-next-line no-fallthrough
        case 'png':
        case 'jpg':
        case 'bmp':
            return Promise.resolve(decodeQrBuffer(fileInfo, log));

        default:
            log.fatal("Unknown data in file", ErrorCode.UNKNOWN_FILE_DATA);
            return Promise.resolve(undefined);
    }

}


// the svg data is turned into an image buffer. these values ensure that the resulting image is readable
// by the QR image decoder. 300x300 fails while 400x400 succeeds 
const svgImageWidth = 600;


// Converts a SVG file into a QR image buffer (as if read from a image file)
async function svgToImageBuffer(svgPath: string, log: Log): Promise<Buffer> {

    // TODO: create a test that causes failure here
    return new Promise<Buffer>((resolve, reject) => {
        svg2img(svgPath, { width: svgImageWidth, height: svgImageWidth },
            (error: unknown, buffer: Buffer) => {
                if (error) {
                    log.fatal("Could not convert SVG to image. Error: " + (error as Error).message);
                    reject(undefined);
                }
                resolve(buffer);
            });
    });
}


// Decode QR image buffer to base64 string
function decodeQrBuffer(fileInfo: FileInfo, log: Log): string | undefined {

    const result: JWS | undefined = undefined;

    //const png = PNG.sync.read(image);
    const data = fileInfo.image;

    if (!data) {
        log.fatal('Could not read image data from : ' + fileInfo.name);
        return undefined;
    }

    // TODO : create a test that causes failure here
    const code = jsQR(new Uint8ClampedArray(data.data.buffer), data.width, data.height);

    if (code == null) {
        log.fatal('Could not decode QR image from : ' + fileInfo.name, ErrorCode.QR_DECODE_ERROR);
        return result;
    }

    return code.data;
}


export function svgToQRImage(filePath: string): Promise<unknown> {

    const baseFileName = filePath.slice(0, filePath.lastIndexOf('.'));

    return new
        Promise<Buffer>((resolve, reject) => {
            svg2img(filePath, { width: 600, height: 600 },
                (error: unknown, buffer: Buffer) => {
                    error ? reject("Could not create image from svg") : resolve(buffer);
                });
        })
        .then((buffer) => {
            fs.writeFileSync(baseFileName + '.png', buffer);
            return Jimp.read(baseFileName + '.png');
        })
        .then(png => {
            return Promise.all([
                png.write(baseFileName + '.bmp'),
                png.grayscale().quality(100).write(baseFileName + '.jpg')
            ]);
        })
        .catch(err => { console.error(err); });
}


export async function dataToQRImage(path: string, data: QRCodeSegment[]) : Promise<void> {

    await toFile(path, data, { type: 'png', errorCorrectionLevel: 'low' })
        .catch((error) => {
            throw error;
        });

}


// const exampleQrCodes: string[] = await Promise.all(
//     qrSet.map((qrSegments): Promise<string> => new Promise((resolve, reject) =>
//       QrCode.toString(qrSegments, { type: 'svg', errorCorrectionLevel: 'low' }, function (err: any, result: string) {
//         if (err) return reject(err);
//         resolve(result as string);
//       })
//     )));