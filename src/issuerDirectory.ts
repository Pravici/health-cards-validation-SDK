import Log, { LogLevels } from './logger';
import got from 'got';
import { ErrorCode } from './error';
import { parseJson } from './utils';

// NOTE: the trusted issuer directory uses the format specified by VCI in https://github.com/the-commons-project/vci-directory/

export interface TrustedIssuer {
    iss: string,
    name: string    
}

export interface TrustedIssuers {
    participating_issuers: TrustedIssuer[]
}

// Known issuers directories
export interface KnownIssuerDirectory {
    name: string,
    URL: string
}
export const KnownIssuerDirectories: KnownIssuerDirectory[] = [
    {
        name: 'VCI',
        URL: 'https://raw.githubusercontent.com/the-commons-project/vci-directory/main/vci-issuers.json'
    },
    {
        name: 'test',
        URL: 'https://raw.githubusercontent.com/smart-on-fhir/health-cards-validation-SDK/main/testdata/test-issuers.json'
    }
]

export class TrustedIssuerDirectory {
    static directoryURL:string;
    static directoryName:string;
    static issuers: TrustedIssuers | undefined;
}


export function checkTrustedIssuerDirectory(iss: string, log: Log) {
    if (TrustedIssuerDirectory.issuers) {
        // extract the VCI issuer friendly name; we assume there are no duplicated URLs in the list
        const issName = TrustedIssuerDirectory.issuers?.participating_issuers.filter(issuer => issuer.iss === iss).map(issuer => issuer.name)[0];
        if (issName) {
            log.debug(`Issuer found in ${TrustedIssuerDirectory.name} directory; name: ${issName}`);
        } else {
            log.error(`Issuer not part of the ${TrustedIssuerDirectory.directoryName} directory`, ErrorCode.ISSUER_NOT_TRUSTED);
        }
    } else {
        // trusted issuers directory not available
        log.error("Error validating against the trusted issuers directory: directory not set");
    }
}