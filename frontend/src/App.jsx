import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractDetails from './contracts/LetterOfRecommendation.json';
import { uploadToIPFS, fetchFromIPFS } from './utils/ipfs';

function App() {
  // Connection states
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [networkName, setNetworkName] = useState('');
  const [userRole, setUserRole] = useState('Public'); // Owner, Approver, Student, Public
  
  // App UI states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success'|'error'|'info', message: '' }

  // Data states
  const [studentCount, setStudentCount] = useState(0);
  const [studentsList, setStudentsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [ownerAddress, setOwnerAddress] = useState('');
  const [approverStatus, setApproverStatus] = useState(false);

  // Search state
  const [searchId, setSearchId] = useState('');
  const [searchedStudent, setSearchedStudent] = useState(null);
  const [searchedLor, setSearchedLor] = useState(null);
  const [fetchingLor, setFetchingLor] = useState(false);

  // Form states
  const [newStudent, setNewStudent] = useState({ name: '', course: '', email: '' });
  const [approverToManage, setApproverToManage] = useState('');
  const [studentIdToRequest, setStudentIdToRequest] = useState('');
  const [lorApproval, setLorApproval] = useState({ studentId: '', letterText: '' });

  // Pre-defined LOR Templates
  const lorTemplates = {
    academic: `To Whom It May Concern,

I am writing this letter to highly recommend [Student Name] for their outstanding academic performance and dedication during their studies in the [Course Name] program.

As their instructor, I have observed [Student Name] to be a highly motivated and intellectually curious student. They consistently rank at the top of their class and exhibit strong analytical and problem-solving skills. Their coursework demonstrates a deep understanding of complex topics, and they are always eager to contribute meaningfully to classroom discussions.

Beyond academic achievements, [Student Name] has shown exceptional leadership and teamwork abilities in class projects. I have no doubt that they will excel in any future academic or professional endeavors they choose to pursue.

Please feel free to contact me if you require any further information.

Sincerely,
[Approver Name]`,
    professional: `To Whom It May Concern,

It is my pleasure to write this recommendation for [Student Name], who was a student in the [Course Name] program. 

During this time, [Student Name] demonstrated remarkable project management capabilities, practical coding skills, and a strong work ethic. They successfully spearheaded several major projects and showed an advanced ability to learn new technologies rapidly.

[Student Name] has a collaborative mindset and communicates ideas clearly. They work exceptionally well under pressure and show high professional integrity. I strongly recommend them for any technical or engineering roles.

Sincerely,
[Approver Name]`
  };

  // Helper to show notifications
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 7000);
  };

  // Connect wallet function
  const connectWallet = async () => {
    if (!window.ethereum) {
      showNotification('error', 'MetaMask is not installed. Please install it to interact with this DApp.');
      return;
    }

    try {
      setLoading(true);
      const tempProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await tempProvider.send('eth_requestAccounts', []);
      const tempSigner = await tempProvider.getSigner();
      
      const network = await tempProvider.getNetwork();
      let netName = network.name === 'unknown' ? `Chain ID: ${network.chainId}` : network.name;
      if (Number(network.chainId) === 11155111n || Number(network.chainId) === 11155111) {
        netName = 'Sepolia Testnet';
      } else if (Number(network.chainId) === 1337n || Number(network.chainId) === 1337 || Number(network.chainId) === 31337) {
        netName = 'Hardhat Localhost';
      }

      setProvider(tempProvider);
      setSigner(tempSigner);
      setWalletAddress(accounts[0]);
      setNetworkName(netName);

      const tempContract = new ethers.Contract(
        contractDetails.address,
        contractDetails.abi,
        tempSigner
      );
      setContract(tempContract);

      showNotification('success', 'Wallet connected successfully!');
    } catch (error) {
      console.error(error);
      showNotification('error', 'Failed to connect wallet: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch contract data
  const fetchData = useCallback(async () => {
    if (!contract) return;
    try {
      // Get Owner Address
      const owner = await contract.owner();
      setOwnerAddress(owner);

      // Get Student Count
      const count = await contract.studentCount();
      const countNum = Number(count);
      setStudentCount(countNum);

      // Get Approver Status for current wallet
      const isApprover = await contract.authorizedApprovers(walletAddress);
      setApproverStatus(isApprover);

      // Fetch all students details
      const fetchedStudents = [];
      const pending = [];
      
      for (let i = 1; i <= countNum; i++) {
        const student = await contract.getStudent(i);
        const studentObj = {
          id: Number(student[0]),
          name: student[1],
          course: student[2],
          email: student[3],
          hasRequested: student[4],
          isApproved: student[5],
          lorIpfsHash: student[6],
          requester: student[7],
          approver: student[8],
        };
        fetchedStudents.push(studentObj);

        if (studentObj.hasRequested && !studentObj.isApproved) {
          pending.push(studentObj);
        }
      }
      
      setStudentsList(fetchedStudents);
      setPendingRequests(pending);

      // Determine User Role
      if (walletAddress.toLowerCase() === owner.toLowerCase()) {
        setUserRole('Owner');
      } else if (isApprover) {
        setUserRole('Approver');
      } else {
        // Check if current user has requested a recommendation
        const isStudent = fetchedStudents.some(s => s.requester.toLowerCase() === walletAddress.toLowerCase());
        setUserRole(isStudent ? 'Student' : 'Public');
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [contract, walletAddress]);

  // Handle chain/account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          connectWallet();
        } else {
          setWalletAddress('');
          setSigner(null);
          setContract(null);
          setUserRole('Public');
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Fetch data on connection
  useEffect(() => {
    if (contract && walletAddress) {
      fetchData();
    }
  }, [contract, walletAddress, fetchData]);

  // Add Student (Owner only)
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!newStudent.name || !newStudent.course || !newStudent.email) {
      showNotification('error', 'All student details must be filled.');
      return;
    }

    try {
      setTxLoading(true);
      const tx = await contract.addStudent(newStudent.name, newStudent.course, newStudent.email);
      showNotification('info', 'Transaction submitted, awaiting confirmation...');
      await tx.wait();
      showNotification('success', `Student "${newStudent.name}" added successfully!`);
      setNewStudent({ name: '', course: '', email: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Transaction failed: ' + (error.reason || error.message));
    } finally {
      setTxLoading(false);
    }
  };

  // Authorize Approver (Owner only)
  const handleAuthorizeApprover = async (authorize = true) => {
    if (!contract || !approverToManage) return;
    if (!ethers.isAddress(approverToManage)) {
      showNotification('error', 'Please enter a valid Ethereum address.');
      return;
    }

    try {
      setTxLoading(true);
      const tx = authorize 
        ? await contract.authorizeApprover(approverToManage)
        : await contract.deauthorizeApprover(approverToManage);
      
      showNotification('info', 'Transaction submitted, awaiting confirmation...');
      await tx.wait();
      showNotification('success', `Approver successfully ${authorize ? 'authorized' : 'deauthorized'}!`);
      setApproverToManage('');
      fetchData();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Transaction failed: ' + (error.reason || error.message));
    } finally {
      setTxLoading(false);
    }
  };

  // Request Recommendation (Student)
  const handleRequestRecommendation = async (e) => {
    e.preventDefault();
    if (!contract || !studentIdToRequest) return;
    const id = parseInt(studentIdToRequest);
    if (isNaN(id) || id <= 0) {
      showNotification('error', 'Please enter a valid Student ID.');
      return;
    }

    try {
      setTxLoading(true);
      const tx = await contract.requestRecommendation(id);
      showNotification('info', 'Submitting request, awaiting confirmation...');
      await tx.wait();
      showNotification('success', 'Recommendation requested successfully! Faculty has been notified.');
      setStudentIdToRequest('');
      fetchData();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Transaction failed: ' + (error.reason || error.message));
    } finally {
      setTxLoading(false);
    }
  };

  // Load LOR template
  const loadTemplate = (type, student) => {
    if (!student) return;
    const approverName = walletAddress === ownerAddress ? "School Dean / Admin" : "Faculty Board Member";
    let text = lorTemplates[type];
    text = text.replace(/\[Student Name\]/g, student.name)
               .replace(/\[Course Name\]/g, student.course)
               .replace(/\[Approver Name\]/g, approverName);
    
    setLorApproval(prev => ({
      ...prev,
      letterText: text
    }));
  };

  // Approve Recommendation (Faculty / Approver)
  const handleApproveRecommendation = async (e) => {
    e.preventDefault();
    if (!contract) return;
    const id = parseInt(lorApproval.studentId);
    if (isNaN(id) || id <= 0) {
      showNotification('error', 'Please enter a valid Student ID.');
      return;
    }
    if (!lorApproval.letterText.trim()) {
      showNotification('error', 'Recommendation letter content cannot be empty.');
      return;
    }

    try {
      setTxLoading(true);
      const student = studentsList.find(s => s.id === id);
      if (!student) {
        showNotification('error', 'Student not found.');
        return;
      }

      showNotification('info', 'Uploading Letter of Recommendation text to IPFS...');
      
      const ipfsResult = await uploadToIPFS(lorApproval.letterText, {
        studentId: id,
        studentName: student.name,
        course: student.course,
        approverAddress: walletAddress
      });

      if (!ipfsResult.success) {
        throw new Error("Failed to pin LoR to IPFS Gateway.");
      }

      showNotification('info', `IPFS upload complete. Hash: ${ipfsResult.ipfsHash}. Submitting blockchain approval...`);

      const tx = await contract.approveRecommendation(id, ipfsResult.ipfsHash);
      await tx.wait();
      
      showNotification('success', `Letter of Recommendation for ${student.name} approved and recorded!`);
      setLorApproval({ studentId: '', letterText: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Operation failed: ' + (error.reason || error.message));
    } finally {
      setTxLoading(false);
    }
  };

  // Search Student & fetch IPFS LoR
  const handleSearchStudent = async (e) => {
    e.preventDefault();
    if (!contract || !searchId) return;
    const id = parseInt(searchId);
    if (isNaN(id) || id <= 0) {
      showNotification('error', 'Please enter a valid Student ID.');
      return;
    }

    try {
      setLoading(true);
      setSearchedStudent(null);
      setSearchedLor(null);

      const student = await contract.getStudent(id);
      const studentObj = {
        id: Number(student[0]),
        name: student[1],
        course: student[2],
        email: student[3],
        hasRequested: student[4],
        isApproved: student[5],
        lorIpfsHash: student[6],
        requester: student[7],
        approver: student[8],
      };
      setSearchedStudent(studentObj);

      if (studentObj.isApproved && studentObj.lorIpfsHash) {
        setFetchingLor(true);
        const ipfsData = await fetchFromIPFS(studentObj.lorIpfsHash);
        if (ipfsData) {
          setSearchedLor(ipfsData);
        }
        setFetchingLor(false);
      }
    } catch (error) {
      console.error(error);
      showNotification('error', 'Failed to retrieve student: Student does not exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header Panel */}
      <header className="app-header glass-panel">
        <div className="logo-container">
          <div className="logo-icon">📜</div>
          <div className="logo-text">LoR Decentrashield</div>
        </div>

        <div className="wallet-panel">
          {walletAddress ? (
            <>
              <div className="network-badge">
                <span className="network-dot"></span>
                <span>{networkName}</span>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} disabled>
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          )}
        </div>
      </header>

      {/* Role Banner / Status info */}
      {walletAddress && (
        <div className="role-banner glass-panel">
          <div>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Connected Role</span>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              {walletAddress}
            </h4>
          </div>
          <span className={`role-tag role-${userRole.toLowerCase()}`}>
            {userRole}
          </span>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`notification-banner notification-${notification.type}`}>
          <span>{notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main content */}
      {!walletAddress ? (
        <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>Decentralized Letters of Recommendation</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '600px', margin: '0 auto 32px' }}>
            A secure, tamper-proof system for university administrators, academic faculty, and students to manage, request, approve, and verify official Letters of Recommendation on-chain.
          </p>
          <button className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }} onClick={connectWallet}>
            🚀 Get Started via MetaMask
          </button>
        </div>
      ) : (
        <>
          {/* Navigation Tabs */}
          <nav className="tabs-nav">
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 Search & Verify
            </button>
            <button 
              className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => setActiveTab('student')}
            >
              🎓 Student Portal
            </button>
            
            {(userRole === 'Owner' || userRole === 'Approver') && (
              <button 
                className={`tab-btn ${activeTab === 'faculty' ? 'active' : ''}`}
                onClick={() => setActiveTab('faculty')}
              >
                🏫 Faculty Portal
              </button>
            )}

            {userRole === 'Owner' && (
              <button 
                className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                ⚙️ Admin Config
              </button>
            )}
          </nav>

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-grid">
              {/* Left Column: Quick Stats */}
              <div className="list-container">
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 className="card-title" style={{ marginBottom: '16px' }}>Network Stats</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid hsla(var(--glass-border))', paddingBottom: '8px' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Total Registered Students</span>
                      <strong style={{ fontSize: '1.1rem' }}>{studentCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid hsla(var(--glass-border))', paddingBottom: '8px' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Pending Requests</span>
                      <strong style={{ fontSize: '1.1rem', color: 'hsl(var(--warning))' }}>{pendingRequests.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid hsla(var(--glass-border))', paddingBottom: '8px' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Approved LoRs</span>
                      <strong style={{ fontSize: '1.1rem', color: 'hsl(var(--success))' }}>
                        {studentsList.filter(s => s.isApproved).length}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 className="card-title" style={{ marginBottom: '12px' }}>Role Capabilities</h3>
                  <ul style={{ color: 'hsl(var(--text-secondary))', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                    <li><strong>Owner:</strong> Manage approvers, register students, request/approve LoRs.</li>
                    <li><strong>Approver:</strong> View pending student requests, upload and approve LoRs.</li>
                    <li><strong>Student:</strong> Submit LoR requests to smart contract by Student ID.</li>
                    <li><strong>Public:</strong> Query student profile and verify credential authenticity.</li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Students Table */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div className="card-header">
                  <h3 className="card-title">All Registered Students</h3>
                  <button className="btn btn-secondary btn-outline" style={{ fontSize: '0.85rem', padding: '6px 12px' }} onClick={fetchData}>
                    🔄 Refresh
                  </button>
                </div>
                
                {studentsList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-secondary))' }}>
                    No students registered in the smart contract yet. {userRole === 'Owner' && 'Go to the Admin Config tab to add your first student.'}
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table-raw">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Course</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsList.map((student) => (
                          <tr key={student.id}>
                            <td><strong>#{student.id}</strong></td>
                            <td>{student.name}</td>
                            <td>{student.course}</td>
                            <td>
                              <span className={`status-badge status-${student.isApproved ? 'approved' : student.hasRequested ? 'pending' : 'none'}`}>
                                {student.isApproved ? 'Approved' : student.hasRequested ? 'Pending Request' : 'No Request'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setActiveTab('search');
                                  setSearchId(student.id.toString());
                                }}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SEARCH & VERIFY */}
          {activeTab === 'search' && (
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div className="card-header">
                <h3 className="card-title">Search & Verify Recommendations</h3>
              </div>
              <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '24px', fontSize: '0.95rem' }}>
                Verify a student's graduation details and recommendation letter using their unique blockchain Student ID. All verification matches cryptographically signed proofs on the Ethereum network.
              </p>

              <form onSubmit={handleSearchStudent} className="student-search-grid" style={{ maxWidth: '600px' }}>
                <input 
                  type="number"
                  placeholder="Enter Student ID (e.g. 1)"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Searching...' : '🔍 Search Blockchain'}
                </button>
              </form>

              {searchedStudent && (
                <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="glass-card">
                    <h3 style={{ marginBottom: '16px', borderBottom: '1px solid hsla(var(--glass-border))', paddingBottom: '10px' }}>
                      Verification Profile
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                      <div>
                        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Student Name</span>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', marginTop: '4px' }}>{searchedStudent.name}</p>
                      </div>
                      <div>
                        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Registered Course</span>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', marginTop: '4px' }}>{searchedStudent.course}</p>
                      </div>
                      <div>
                        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Contact Email</span>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', marginTop: '4px' }}>{searchedStudent.email}</p>
                      </div>
                      <div>
                        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Verifiable Status</span>
                        <div style={{ marginTop: '4px' }}>
                          <span className={`status-badge status-${searchedStudent.isApproved ? 'approved' : searchedStudent.hasRequested ? 'pending' : 'none'}`}>
                            {searchedStudent.isApproved ? 'Verified Approved' : searchedStudent.hasRequested ? 'Pending Review' : 'No Active Request'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {searchedStudent.isApproved && (
                      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid hsla(var(--glass-border))', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>Signer/Approver Address: </span>
                            <code style={{ color: 'hsl(var(--primary))' }}>{searchedStudent.approver}</code>
                          </div>
                          <div>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>IPFS Content Identifier (CID): </span>
                            <a 
                              href={searchedStudent.lorIpfsHash.startsWith('QmSimulateLoR') 
                                ? '#' 
                                : `https://gateway.pinata.cloud/ipfs/${searchedStudent.lorIpfsHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ color: 'hsl(var(--secondary))', textDecoration: 'underline' }}
                            >
                              {searchedStudent.lorIpfsHash.substring(0, 15)}...
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Render LOR letter if approved */}
                  {searchedStudent.isApproved && (
                    <div>
                      <h4 style={{ marginBottom: '12px' }}>Letter of Recommendation</h4>
                      {fetchingLor ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '20px' }}>
                          <div className="spinner"></div>
                          <span>Downloading certified document from IPFS network...</span>
                        </div>
                      ) : searchedLor ? (
                        <div>
                          <div className="lor-letter-display">
                            <div className="lor-letter-header">
                              <h2>UNIVERSITY RECOMMENDATION LETTER</h2>
                              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                Verified On-Chain Credential | Student ID: #{searchedStudent.id}
                              </p>
                            </div>
                            <div className="lor-letter-body">
                              {searchedLor.text}
                            </div>
                            <div className="lor-letter-footer">
                              <div>
                                <strong>Approver Wallet:</strong><br />
                                {searchedStudent.approver}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <strong>Smart Contract:</strong><br />
                                {contractDetails.address}
                              </div>
                            </div>
                          </div>
                          <button 
                            className="btn btn-secondary btn-outline" 
                            style={{ marginTop: '16px' }}
                            onClick={() => window.print()}
                          >
                            🖨️ Print Certified Document
                          </button>
                        </div>
                      ) : (
                        <div style={{ color: 'hsl(var(--error))' }}>
                          Could not retrieve letter text from IPFS. (Ensure gateway connection is active).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STUDENT PORTAL */}
          {activeTab === 'student' && (
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div className="card-header">
                <h3 className="card-title">Student Recommendation Requests</h3>
              </div>
              <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '24px', fontSize: '0.95rem' }}>
                Students who have been registered in the system by the administration can request recommendation letters from the faculty board. Make sure your wallet is the one intended to manage the recommendation.
              </p>

              <form onSubmit={handleRequestRecommendation} style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Your Registered Student ID</label>
                  <input 
                    type="number"
                    placeholder="Enter Student ID (e.g. 1)"
                    className="form-input"
                    value={studentIdToRequest}
                    onChange={(e) => setStudentIdToRequest(e.target.value)}
                    required
                  />
                  <small style={{ color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                    Note: If you do not know your Student ID, check the main dashboard table list or contact administration.
                  </small>
                </div>

                <button type="submit" className="btn btn-primary" disabled={txLoading}>
                  {txLoading ? (
                    <>
                      <div className="spinner" style={{ marginRight: '8px' }}></div>
                      Confirming on Blockchain...
                    </>
                  ) : 'Submit Request'}
                </button>
              </form>

              {/* Display current user's request details */}
              <div style={{ marginTop: '40px' }}>
                <h4 style={{ marginBottom: '16px' }}>Your Student Requests</h4>
                
                {studentsList.filter(s => s.requester.toLowerCase() === walletAddress.toLowerCase()).length === 0 ? (
                  <div className="glass-card" style={{ textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                    You have not submitted any recommendation requests from this wallet address yet.
                  </div>
                ) : (
                  <div className="list-container">
                    {studentsList
                      .filter(s => s.requester.toLowerCase() === walletAddress.toLowerCase())
                      .map(s => (
                        <div key={s.id} className="lor-item-card">
                          <div>
                            <strong>Student Profile: {s.name}</strong>
                            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
                              Course: {s.course} | Student ID: #{s.id}
                            </p>
                          </div>
                          <div>
                            <span className={`status-badge status-${s.isApproved ? 'approved' : 'pending'}`}>
                              {s.isApproved ? 'Approved & Sealed' : 'Awaiting Faculty Signature'}
                            </span>
                            {s.isApproved && (
                              <button 
                                className="btn btn-secondary btn-outline" 
                                style={{ marginLeft: '12px', padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setActiveTab('search');
                                  setSearchId(s.id.toString());
                                }}
                              >
                                View Letter
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FACULTY PORTAL */}
          {activeTab === 'faculty' && (userRole === 'Owner' || userRole === 'Approver') && (
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div className="card-header">
                <h3 className="card-title">Faculty Recommendation Panel</h3>
              </div>
              <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '24px', fontSize: '0.95rem' }}>
                Review and approve outstanding recommendation requests from students. Select a request to generate a beautiful, personalized recommendation using academic or professional templates, and publish it securely to IPFS and the Ethereum blockchain.
              </p>

              <div className="dashboard-grid">
                {/* Left: Pending List */}
                <div>
                  <h4 style={{ marginBottom: '16px' }}>Pending Requests ({pendingRequests.length})</h4>
                  {pendingRequests.length === 0 ? (
                    <div className="glass-card" style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>
                      No pending requests available. All students have been processed!
                    </div>
                  ) : (
                    <div className="list-container">
                      {pendingRequests.map(student => (
                        <div 
                          key={student.id} 
                          className="glass-card"
                          style={{ 
                            padding: '16px', 
                            cursor: 'pointer',
                            borderColor: lorApproval.studentId === student.id.toString() ? 'hsl(var(--primary))' : ''
                          }}
                          onClick={() => {
                            setLorApproval({
                              studentId: student.id.toString(),
                              letterText: ''
                            });
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>#{student.id} - {student.name}</strong>
                            <span className="status-badge status-pending">Pending</span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '6px' }}>
                            {student.course}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Recommendation Builder Form */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ marginBottom: '16px' }}>Compose Recommendation Letter</h4>
                  
                  <form onSubmit={handleApproveRecommendation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Student ID</label>
                      <input 
                        type="number"
                        placeholder="Select from pending or enter ID"
                        className="form-input"
                        value={lorApproval.studentId}
                        onChange={(e) => setLorApproval({ ...lorApproval, studentId: e.target.value })}
                        required
                      />
                    </div>

                    {lorApproval.studentId && (
                      <div className="form-group">
                        <label className="form-label">Apply Professional Template</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            style={{ fontSize: '0.85rem', flex: 1 }}
                            onClick={() => {
                              const s = studentsList.find(s => s.id.toString() === lorApproval.studentId);
                              loadTemplate('academic', s);
                            }}
                            disabled={!studentsList.some(s => s.id.toString() === lorApproval.studentId)}
                          >
                            Academic Reference
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            style={{ fontSize: '0.85rem', flex: 1 }}
                            onClick={() => {
                              const s = studentsList.find(s => s.id.toString() === lorApproval.studentId);
                              loadTemplate('professional', s);
                            }}
                            disabled={!studentsList.some(s => s.id.toString() === lorApproval.studentId)}
                          >
                            Professional Reference
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Letter of Recommendation Content</label>
                      <textarea 
                        placeholder="Write the letter of recommendation details here. You can use standard formatting..."
                        className="form-textarea"
                        value={lorApproval.letterText}
                        onChange={(e) => setLorApproval({ ...lorApproval, letterText: e.target.value })}
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={txLoading}>
                      {txLoading ? (
                        <>
                          <div className="spinner" style={{ marginRight: '8px' }}></div>
                          Uploading & Signing...
                        </>
                      ) : '✍️ Approve & Sign to Blockchain'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADMIN CONFIG */}
          {activeTab === 'admin' && userRole === 'Owner' && (
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div className="card-header">
                <h3 className="card-title">Administrative Configurations</h3>
              </div>
              <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '24px', fontSize: '0.95rem' }}>
                Owner-only configurations to authorize new faculty members to write recommendations and register new students in the database.
              </p>

              <div className="dashboard-grid">
                {/* Admin Box 1: Add Student */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ marginBottom: '16px' }}>Register New Student</h4>
                  <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input 
                        type="text"
                        placeholder="John Doe"
                        className="form-input"
                        value={newStudent.name}
                        onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Course / Program</label>
                      <input 
                        type="text"
                        placeholder="Computer Science BSc"
                        className="form-input"
                        value={newStudent.course}
                        onChange={(e) => setNewStudent({ ...newStudent, course: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input 
                        type="email"
                        placeholder="john@university.edu"
                        className="form-input"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={txLoading}>
                      {txLoading ? (
                        <>
                          <div className="spinner" style={{ marginRight: '8px' }}></div>
                          Adding Student...
                        </>
                      ) : 'Register Student'}
                    </button>
                  </form>
                </div>

                {/* Admin Box 2: Manage Approvers */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ marginBottom: '16px' }}>Manage Faculty Approvers</h4>
                  
                  <div className="form-group">
                    <label className="form-label">Faculty Wallet Address</label>
                    <input 
                      type="text"
                      placeholder="0x..."
                      className="form-input"
                      value={approverToManage}
                      onChange={(e) => setApproverToManage(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => handleAuthorizeApprover(true)}
                      disabled={txLoading}
                    >
                      Authorize Approver
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => handleAuthorizeApprover(false)}
                      disabled={txLoading}
                    >
                      Deauthorize
                    </button>
                  </div>

                  {/* List of currently authorized (mock or scanned) */}
                  <div style={{ marginTop: '24px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                      * Owner (you) is permanently authorized by default.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
