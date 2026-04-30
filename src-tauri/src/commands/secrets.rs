// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Tiny wrapper over the `keyring` crate for storing small encrypted blobs
// (branding JSON, integration API keys, SMTP credentials) keyed by a
// stable string. Keyring uses Windows Credential Manager on Windows,
// Keychain on macOS, and the kernel keyutils backend on Linux.
//
// The stored payload is the raw secret string; the OS does the encryption
// at rest. Callers serialize JSON before passing it in.
//
// All functions are *infallible from the caller's perspective when there's
// no value yet* — `read` returns `Ok(None)` for a missing entry rather than
// surfacing a "no entry" error to the UI.

const SERVICE: &str = "freshrig";

pub fn read(key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| format!("keyring entry: {}", e))?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring read: {}", e)),
    }
}

pub fn write(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| format!("keyring entry: {}", e))?;
    entry
        .set_password(value)
        .map_err(|e| format!("keyring write: {}", e))
}

#[allow(dead_code)]
pub fn delete(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| format!("keyring entry: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {}", e)),
    }
}
