/* Lakfa ERP Company Profile Controller */
import { getDocument, saveDocument } from "./firebase-db.js";
import { showToast } from "./utils.js";

const COMPANY_COLLECTION = "settings";
const COMPANY_DOCUMENT = "companyProfile";
const MAX_INPUT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DATA_URL_BYTES = 700 * 1024;
const MAX_IMAGE_DIMENSION = 640;
const IMAGE_QUALITY = 0.82;

const COMPANY_FIELDS = [
  "companyName",
  "gst",
  "address",
  "phone",
  "email",
  "website",
  "socialLinks",
  "businessType",
  "businessCategory",
  "state",
  "pincode",
  "logoDataUrl",
  "signatureDataUrl"
];

export async function loadCompanyProfile() {
  return (await getDocument(COMPANY_COLLECTION, COMPANY_DOCUMENT)) || {};
}

export async function saveCompanyProfile(profile) {
  await saveDocument(COMPANY_COLLECTION, COMPANY_DOCUMENT, profile);
}

export function applyCompanyProfile(profile = {}) {
  const displayName = profile.companyName || "Lakfa ERP";
  const logoSource = profile.logoDataUrl || profile.logoUrl || "";

  document.querySelectorAll("[data-company-name]").forEach((el) => {
    el.textContent = displayName;
  });

  document.querySelectorAll("[data-company-email]").forEach((el) => {
    el.textContent = profile.email || "";
  });

  document.querySelectorAll("[data-company-phone]").forEach((el) => {
    el.textContent = profile.phone || "";
  });

  document.querySelectorAll("[data-company-logo]").forEach((img) => {
    if (logoSource) {
      img.src = logoSource;
      img.classList.remove("d-none");
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.classList.add("d-none");
      img.hidden = true;
    }
  });

  document.title = `${displayName} - ERP`;
}

export async function applyCompanyProfileFromFirebase() {
  try {
    const profile = await loadCompanyProfile();
    applyCompanyProfile(profile);
    return profile;
  } catch (err) {
    console.error("Unable to load company profile", err);
    return {};
  }
}

export async function initCompanyProfileForm() {
  const form = document.getElementById("company-profile-form");
  if (!form) return;

  const profile = await applyCompanyProfileFromFirebase();
  populateCompanyProfileForm(form, profile);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    try {
      const existingProfile = await loadCompanyProfile();
      const payload = {
        ...existingProfile,
        ...getCompanyProfileFormData(form)
      };
      const logoFile = form.querySelector("#company-logo-file")?.files?.[0];
      const signatureFile = form.querySelector("#company-signature-logo-file")?.files?.[0];

      if (logoFile) {
        payload.logoDataUrl = await imageFileToCompressedDataUrl(logoFile, "Company logo");
        payload.logoUrl = "";
      }

      if (signatureFile) {
        payload.signatureDataUrl = await imageFileToCompressedDataUrl(signatureFile, "Signature logo");
        payload.signatureLogoUrl = "";
      }

      await saveCompanyProfile(payload);
      const savedProfile = await loadCompanyProfile();
      applyCompanyProfile(savedProfile);
      populateCompanyProfileForm(form, savedProfile);
      form.querySelector("#company-logo-file").value = "";
      form.querySelector("#company-signature-logo-file").value = "";
      showToast("Company profile saved to Firestore.", "success");
    } catch (err) {
      console.error("Unable to save company profile", err);
      showToast(err.message || "Unable to save company profile. Please check Firebase permissions.", "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function populateCompanyProfileForm(form, profile) {
  COMPANY_FIELDS.forEach((field) => {
    const input = form.querySelector(`[name="${field}"]`);
    if (input && input.type !== "file") {
      input.value = profile[field] || "";
    }
  });

  updatePreviewImage("company-logo-preview", profile.logoDataUrl || profile.logoUrl);
  updatePreviewImage("company-signature-logo-preview", profile.signatureDataUrl || profile.signatureLogoUrl);
  updateImageStatus("company-logo-status", profile.logoDataUrl);
  updateImageStatus("company-signature-logo-status", profile.signatureDataUrl);
}

function getCompanyProfileFormData(form) {
  const data = {};
  COMPANY_FIELDS.forEach((field) => {
    const input = form.querySelector(`[name="${field}"]`);
    if (input && input.type !== "file") {
      data[field] = input.value.trim();
    }
  });
  return data;
}

async function imageFileToCompressedDataUrl(file, label) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${label} must be an image file.`);
  }

  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error(`${label} must be smaller than 2 MB before compression.`);
  }

  const bitmap = await loadImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(outputType, IMAGE_QUALITY);
  if (dataUrl.length > MAX_DATA_URL_BYTES) {
    throw new Error(`${label} is still too large after compression. Use a smaller logo image.`);
  }
  return dataUrl;
}

function loadImageBitmap(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to read selected image."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Unable to read selected image."));
    reader.readAsDataURL(file);
  });
}

function updatePreviewImage(elementId, url) {
  const img = document.getElementById(elementId);
  if (!img) return;

  if (url) {
    img.src = url;
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
  }
}

function updateImageStatus(elementId, dataUrl) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = dataUrl
    ? `Saved in Firestore (${Math.round(dataUrl.length / 1024)} KB text image)`
    : "No Firestore image saved yet.";
}

document.addEventListener("DOMContentLoaded", () => {
  applyCompanyProfileFromFirebase();
});
