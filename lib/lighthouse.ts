import axios from "axios";
import { ethers } from "ethers";
import lighthouse from "@lighthouse-web3/sdk";

/**
 * Signs an authentication message using a private key
 * @param privateKey The private key to sign with
 * @param verificationMessage The message to sign
 * @returns The signed message
 */
export const signAuthMessage = async (
  privateKey: string,
  verificationMessage: string
) => {
  const signer = new ethers.Wallet(privateKey);
  const signedMessage = await signer.signMessage(verificationMessage);
  return signedMessage;
};

/**
 * Gets an API key from Lighthouse
 * @param publicKey The public key of the wallet
 * @param privateKey The private key of the wallet
 * @returns The API key response
 */
export const getApiKey = async (publicKey: string, privateKey: string) => {
  try {
    const verificationMessage = (
      await axios.get(
        `https://api.lighthouse.storage/api/auth/get_message?publicKey=${publicKey}`
      )
    ).data;

    const signedMessage = await signAuthMessage(
      privateKey,
      verificationMessage
    );
    const response = await lighthouse.getApiKey(publicKey, signedMessage);
    return response;
  } catch (error) {
    console.error("Error getting Lighthouse API key:", error);
    throw error;
  }
};

/**
 * Uploads a file to Lighthouse
 * @param file The file to upload
 * @param apiKey The Lighthouse API key
 * @param onProgress Optional callback for upload progress
 * @returns The upload response
 */
export const uploadFile = async (
  file: File | Blob,
  apiKey: string,
  onProgress?: (progressData: { total: number; uploaded: number }) => void
) => {
  try {
    const response = await lighthouse.upload(
      file,
      apiKey,
      1 // Single file
      //onProgress || undefined
    );
    return response;
  } catch (error) {
    console.error("Error uploading to Lighthouse:", error);
    throw error;
  }
};

/**
 * Uploads a file from a URL to Lighthouse
 * @param url The URL of the file to upload
 * @param apiKey The Lighthouse API key
 * @returns The upload response
 */
export const uploadFromUrl = async (url: string, apiKey: string) => {
  try {
    // Fetch the file from the URL
    const response = await fetch(url);
    const blob = await response.blob();

    // Get file name from URL
    const fileName = url.split("/").pop() || "file";

    // Create a File object
    const file = new File([blob], fileName, { type: blob.type });

    // Upload to Lighthouse
    return await uploadFile(file, apiKey);
  } catch (error) {
    console.error("Error uploading from URL to Lighthouse:", error);
    throw error;
  }
};

/**
 * Gets the gateway URL for a CID
 * @param cid The CID of the file
 * @returns The gateway URL
 */
export const getGatewayUrl = (cid: string) => {
  return `https://gateway.lighthouse.storage/ipfs/${cid}`;
};
