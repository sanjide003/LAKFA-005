/* Lakfa ERP Company Profile Controller */
import { getDocument, saveDocument } from "./firebase-db.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast } from "./utils.js";

const COMPANY_COLLECTION = "settings";
const COMPANY_DOCUMENT = "companyProfile";
const MAX_INPUT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DATA_URL_BYTES = 700 * 1024;
const MAX_IMAGE_DIMENSION = 640;
const IMAGE_QUALITY = 0.82;

const AUTH_WAIT_TIMEOUT_MS = 2500;

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
  await waitForAuthReady();
  return normalizeCompanyProfile((await getDocument(COMPANY_COLLECTION, COMPANY_DOCUMENT)) || {});
}

export async function saveCompanyProfile(profile) {
  await waitForAuthReady();
  await saveDocument(COMPANY_COLLECTION, COMPANY_DOCUMENT, normalizeCompanyProfile(profile));
}

function waitForAuthReady() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = null;
    const finish = (user = null) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      resolve(user);
    };
    unsubscribe = onAuthStateChanged(auth, (user) => finish(user));
    setTimeout(() => finish(auth.currentUser), AUTH_WAIT_TIMEOUT_MS);
  });
}

function normalizeCompanyProfile(profile = {}) {
  return {
    ...profile,
    companyName: profile.companyName || profile.name || profile.company || "",
    gst: profile.gst || profile.gstNumber || profile.gstin || "",
    address: profile.address || profile.companyAddress || "",
    phone: profile.phone || profile.mobile || profile.contactNumber || "",
    email: profile.email || profile.companyEmail || "",
    website: profile.website || profile.websiteLink || "",
    logoDataUrl: profile.logoDataUrl || profile.logoUrl || "",
    signatureDataUrl: profile.signatureDataUrl || profile.signatureLogoUrl || ""
  };
}

export function applyCompanyProfile(profile = {}) {
  const normalizedProfile = normalizeCompanyProfile(profile);
  const displayName = normalizedProfile.companyName || "Lakfa ERP";
  const logoSource = normalizedProfile.logoDataUrl || normalizedProfile.logoUrl || "";

  document.querySelectorAll("[data-company-name]").forEach((el) => {
    el.textContent = displayName;
  });

  document.querySelectorAll("[data-company-email]").forEach((el) => {
    el.textContent = normalizedProfile.email || "";
  });

  document.querySelectorAll("[data-company-phone]").forEach((el) => {
    el.textContent = normalizedProfile.phone || "";
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

  document.querySelectorAll("[data-company-gst]").forEach((el) => {
    el.textContent = normalizedProfile.gst || "";
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
  initCompanyImageControls(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    try {
      const existingProfile = await loadCompanyProfile();
      const payload = normalizeCompanyProfile({
        ...existingProfile,
        ...getCompanyProfileFormData(form)
      });
      const logoFile = form.querySelector("#company-logo-file")?.files?.[0];
      const signatureFile = form.querySelector("#company-signature-logo-file")?.files?.[0];

      if (form.dataset.removeLogo === "true") {
        payload.logoDataUrl = "";
        payload.logoUrl = "";
      }

      if (form.dataset.removeSignature === "true") {
        payload.signatureDataUrl = "";
        payload.signatureLogoUrl = "";
      }

      if (logoFile) {
        payload.logoDataUrl = await imageFileToCompressedDataUrl(logoFile, "Company logo");
        payload.logoUrl = "";
        form.dataset.removeLogo = "false";
      }

      if (signatureFile) {
        payload.signatureDataUrl = await imageFileToCompressedDataUrl(signatureFile, "Signature logo");
        payload.signatureLogoUrl = "";
        form.dataset.removeSignature = "false";
      }

      await saveCompanyProfile(payload);
      const savedProfile = await loadCompanyProfile();
      applyCompanyProfile(savedProfile);
      populateCompanyProfileForm(form, savedProfile);
      form.dataset.removeLogo = "false";
      form.dataset.removeSignature = "false";
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
  const normalizedProfile = normalizeCompanyProfile(profile);
  COMPANY_FIELDS.forEach((field) => {
    const input = form.querySelector(`[name="${field}"]`);
    if (input && input.type !== "file") {
      input.value = normalizedProfile[field] || "";
    }
  });

  updatePreviewImage("company-logo-preview", normalizedProfile.logoDataUrl || normalizedProfile.logoUrl);
  updatePreviewImage("company-signature-logo-preview", normalizedProfile.signatureDataUrl || normalizedProfile.signatureLogoUrl);
  updateImageStatus("company-logo-status", normalizedProfile.logoDataUrl);
  updateImageStatus("company-signature-logo-status", normalizedProfile.signatureDataUrl);
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

function initCompanyImageControls(form) {
  const logoInput = form.querySelector("#company-logo-file");
  const signatureInput = form.querySelector("#company-signature-logo-file");
  const logoRemove = form.querySelector("#remove-company-logo-btn");
  const signatureRemove = form.querySelector("#remove-company-signature-logo-btn");

  form.dataset.removeLogo = "false";
  form.dataset.removeSignature = "false";

  logoInput?.addEventListener("change", () => previewSelectedImage(logoInput, "company-logo-preview", "company-logo-status", "Company logo selected; save to persist it."));
  signatureInput?.addEventListener("change", () => previewSelectedImage(signatureInput, "company-signature-logo-preview", "company-signature-logo-status", "Signature image selected; save to persist it."));

  logoRemove?.addEventListener("click", () => {
    form.dataset.removeLogo = "true";
    if (logoInput) logoInput.value = "";
    setNamedFieldValue(form, "logoDataUrl", "");
    updatePreviewImage("company-logo-preview", "");
    updateImageStatus("company-logo-status", "", "Logo marked for removal. Save the profile to persist this change.");
  });

  signatureRemove?.addEventListener("click", () => {
    form.dataset.removeSignature = "true";
    if (signatureInput) signatureInput.value = "";
    setNamedFieldValue(form, "signatureDataUrl", "");
    updatePreviewImage("company-signature-logo-preview", "");
    updateImageStatus("company-signature-logo-status", "", "Signature marked for removal. Save the profile to persist this change.");
  });
}

function previewSelectedImage(input, previewId, statusId, message) {
  const file = input?.files?.[0];
  if (!file) return;
  const previewUrl = URL.createObjectURL(file);
  updatePreviewImage(previewId, previewUrl, () => URL.revokeObjectURL(previewUrl));
  updateImageStatus(statusId, "", message);
}

function setNamedFieldValue(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);
  if (field) field.value = value;
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

function updatePreviewImage(elementId, url, onLoad) {
  const img = document.getElementById(elementId);
  if (!img) return;

  if (url) {
    if (onLoad) img.onload = onLoad;
    img.src = url;
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
  }
}

function updateImageStatus(elementId, dataUrl, fallbackText = "No Firestore image saved yet.") {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = dataUrl
    ? `Saved in Firestore (${Math.round(dataUrl.length / 1024)} KB text image)`
    : fallbackText;
}

document.addEventListener("DOMContentLoaded", () => {
  applyCompanyProfileFromFirebase();
});
