import { BlobServiceClient } from "@azure/storage-blob";
import { PdfReader } from "pdfreader";
import dotenv from "dotenv";

dotenv.config();

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "resumes"; // your blob container
const PREFIX = "Rupesh/";         // folder/prefix

export async function extractPdfTextFromBlob() {
  if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error("Azure Storage connection string is not set in .env");
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  // List blobs under prefix
  let blobName = null;
  for await (const blob of containerClient.listBlobsFlat({ prefix: PREFIX })) {
    if (blob.name.toLowerCase().endsWith(".pdf")) {
      blobName = blob.name;
      break; // take the first PDF found
    }
  }

  if (!blobName) throw new Error("No PDF found in blob storage under prefix " + PREFIX);

  const blobClient = containerClient.getBlobClient(blobName);
  const downloadResponse = await blobClient.download();
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Parse PDF
  return new Promise((resolve, reject) => {
    let allText = "";
    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) reject(err);
      else if (!item) resolve(allText.trim());
      else if (item.text) allText += item.text;
    });
  });
}
