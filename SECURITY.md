# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅ Yes     |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in this project, please report it responsibly:

- Open a private report on the [GitHub Security Advisories](https://github.com/riverbornai/offline-ai-chat/security/advisories/new) page, or
- Email **[hello@riverborn.com](mailto:hello@riverborn.com)** with "Security" in the subject line.

We aim to reply within **72 hours** and will work with you on a fix before any public disclosure.

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (if any)

## Notes

After the one-time model downloads (from Hugging Face and GitHub), the app runs chat, speech-to-text and text-to-speech on the device and does not send your messages or audio to any server. Vulnerabilities in model downloading, on-device model loading, file handling or native modules are still important to report.

Thank you for helping keep this project secure.
