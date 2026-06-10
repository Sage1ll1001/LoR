// IPFS integration utility (using Pinata)
// Supports optional Pinata JWT token or falls back to a simulated local IPFS node using localStorage

export const uploadToIPFS = async (textData, metadata = {}) => {
  // Try to read JWT from environment variables
  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
  
  if (!PINATA_JWT) {
    console.log("No Pinata JWT found in env. Falling back to local data-URI simulation...");
    // Local simulation: Create a simulated IPFS hash and save content to localStorage
    const content = JSON.stringify({ text: textData, metadata, timestamp: Date.now() });
    const mockHash = `QmSimulateLoR${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    
    // Save to localStorage so we can retrieve it locally in browser
    localStorage.setItem(mockHash, content);
    return {
      success: true,
      ipfsHash: mockHash,
      gatewayUrl: `local-simulation://${mockHash}`
    };
  }

  try {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify({
        pinataContent: {
          text: textData,
          metadata: metadata,
          timestamp: Date.now()
        },
        pinataMetadata: {
          name: `LoR_${metadata.studentName || "Student"}.json`
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Pinata error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      ipfsHash: data.IpfsHash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
    };
  } catch (error) {
    console.error("IPFS upload failed:", error);
    throw error;
  }
};

export const fetchFromIPFS = async (ipfsHash) => {
  if (!ipfsHash) return null;

  // If it's a simulated hash
  if (ipfsHash.startsWith("QmSimulateLoR")) {
    const localContent = localStorage.getItem(ipfsHash);
    if (localContent) {
      return JSON.parse(localContent);
    }
    return { text: "Simulated LoR letter content could not be found in local storage.", metadata: {} };
  }

  try {
    // Try Pinata gateway first, then fallback to public gateways
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      `https://ipfs.io/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
    ];

    for (const url of gateways) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) }); // Timeout after 5s
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`Gateway ${url} failed, trying next...`);
      }
    }
    throw new Error("All IPFS gateways failed to fetch content");
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    // Return a mock object so UI doesn't crash
    return { text: `Failed to load IPFS data (CID: ${ipfsHash}). Pinata token might be missing or network timed out.`, metadata: {} };
  }
};
