import forge from "node-forge";

export interface CryptoBundle {
  cert: string;
  privateKey: string;
  publicKey: string;
}

export function generateApiKey(): string {
  const bytes = forge.random.getBytesSync(128);
  const md = forge.md.sha256.create();
  md.update(bytes);
  return md.digest().toHex();
}

export function generateCertificate(
  bindingHost: string,
  subjectAltNames?: string,
): CryptoBundle {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + 1,
  );

  const attrs = [
    { name: "commonName", value: "Obsidian API" },
    { name: "organizationName", value: "Obsidian API Plugin" },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  const altNames: forge.pki.SubjectAltName[] = [
    { type: 2, value: "localhost" }, // DNS
    { type: 7, ip: "127.0.0.1" }, // IP
  ];

  if (bindingHost && bindingHost !== "127.0.0.1" && bindingHost !== "localhost") {
    if (bindingHost.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      altNames.push({ type: 7, ip: bindingHost });
    } else {
      altNames.push({ type: 2, value: bindingHost });
    }
  }

  if (subjectAltNames) {
    for (const san of subjectAltNames.split("\n")) {
      const trimmed = san.trim();
      if (!trimmed) continue;
      if (trimmed.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        altNames.push({ type: 7, ip: trimmed });
      } else {
        altNames.push({ type: 2, value: trimmed });
      }
    }
  }

  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      critical: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: true,
      clientAuth: true,
    },
    {
      name: "subjectAltName",
      altNames,
    },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    cert: forge.pki.certificateToPem(cert),
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    publicKey: forge.pki.publicKeyToPem(keys.publicKey),
  };
}

export function getCertificateValidityDays(certPem: string): number {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const now = new Date();
    const expiryMs = cert.validity.notAfter.getTime() - now.getTime();
    return Math.floor(expiryMs / (1000 * 60 * 60 * 24));
  } catch {
    return -1;
  }
}

export function isCertificateValid(certPem: string): boolean {
  return getCertificateValidityDays(certPem) > 0;
}
