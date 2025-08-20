import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Users, Mail } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const ExcelProcessor = () => {
  const [data, setData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [exercise1ProcessedData, setExercise1ProcessedData] = useState([]);
  const [duplicateStats, setDuplicateStats] = useState({});
  const [activeTab, setActiveTab] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setFileName(file.name);
    
    try {
      console.log('Processing file:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      console.log('Loaded data:', jsonData.length, 'rows');
      console.log('Sample row:', jsonData[0]);
      
      setData(jsonData);
      setActiveTab('exercise1');
    } catch (error) {
      console.error('File processing error:', error);
      setError('Error reading file: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper function to convert to proper case
  const toProperCase = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Exercise 1: Sanitize for email campaign
  const processExercise1 = useCallback(() => {
    console.log('Processing Exercise 1 with data:', data.length, 'rows');
    setIsLoading(true);
    setError('');
    
    try {
      const sanitized = data.map((row, index) => {
        console.log(`Processing row ${index}:`, row);
        return {
          'Destination': (row.EMAIL || '').toString().toLowerCase().trim(),
          'First Name': toProperCase(row.FNAME || ''),
          'Last Name': toProperCase(row.LNAME || ''),
          'License Type': (row.LICENSE_TYPE || '').toString(),
          'Resident Flag': (row.RES_FLAG || '').toString(),
          'Customer ID': (row.CUSTID || '').toString()
        };
      }).filter(row => row.Destination && row['First Name'] && row['Last Name']);

      console.log('Sanitized data:', sanitized.length, 'rows');
      setExercise1ProcessedData(sanitized);
    } catch (error) {
      console.error('Processing error:', error);
      setError('Error processing data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  // Exercise 2: Handle duplicates with personalization
  const processExercise2 = useCallback(() => {
    console.log('Processing Exercise 2 with data:', data.length, 'rows');
    setIsLoading(true);
    setError('');
    
    try {
      const emailGroups = {};
      const stats = {
        totalRecords: data.length,
        uniqueEmails: 0,
        duplicateEmails: 0,
        duplicateGroups: []
      };

      // Group by email address
      data.forEach((row, index) => {
        const email = (row.EMAIL || '').toString().toLowerCase().trim();
        if (!email) {
          console.log(`Row ${index} has no email:`, row);
          return;
        }

        if (!emailGroups[email]) {
          emailGroups[email] = [];
        }
        const licenseType = (row.LICENSE_TYPE || '').toString();
        if (licenseType === 'Hunting' || licenseType === 'Combination') {
          emailGroups[email].push({
            custId: (row.CUSTID || '').toString(),
            firstName: toProperCase(row.FNAME || ''),
            lastName: toProperCase(row.LNAME || ''),
            email: email,
            licenseType: licenseType,
            resFlag: (row.RES_FLAG || '').toString()
          });
        }
      });

      console.log('Email groups created:', Object.keys(emailGroups).length);

      // Process each email group
      const deduplicatedData = [];
      
      Object.keys(emailGroups).forEach(email => {
        const group = emailGroups[email];
        // Only process groups that still have customers after filtering
        if (group.length === 0) {
          return; 
        }
        stats.uniqueEmails++;
        
        if (group.length > 1) {
          stats.duplicateEmails++;
          stats.duplicateGroups.push({
            email: email,
            count: group.length,
            customers: group
          });
        }

        // Create personalized entry for this email
        const personalizedEntry = createPersonalizedEntry(group);
        deduplicatedData.push(personalizedEntry);
      });

      console.log('Deduplicated data:', deduplicatedData.length, 'rows');
      console.log('Stats:', stats);

      setProcessedData(deduplicatedData);
      setDuplicateStats(stats);
    } catch (error) {
      console.error('Processing error:', error);
      setError('Error processing data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  // Create personalized entry for duplicate emails
  const createPersonalizedEntry = (customers) => {
    if (customers.length === 1) {
      return {
        'Destination': customers[0].email,
        'First Name': customers[0].firstName,
        'Last Name': customers[0].lastName,
        'License Type': customers[0].licenseType,
        'Customer IDs': customers[0].custId,
        'Multiple Accounts': 'No',
        'Account Count': '1'
      };
    }

    // Handle multiple customers with same email
    const firstCustomer = customers[0];
    const allCustIds = customers.map(c => c.custId).join(', ');
    const uniqueFirstNames = [...new Set(customers.map(c => c.firstName))];
    const uniqueLastNames = [...new Set(customers.map(c => c.lastName))];

    return {
      'Destination': firstCustomer.email,
      'First Name': uniqueFirstNames.join(', '),
      'Last Name': uniqueLastNames.join(', '),
      'License Type': customers.map(c => c.licenseType).join(', '),
      'Customer IDs': allCustIds,
      'Multiple Accounts': 'Yes',
      'Account Count': customers.length.toString()
    };
  };

  // Save data to localStorage for persistence
  const saveToLocalStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Could not save to localStorage:', error);
    }
  };

  // Load data from localStorage
  const loadFromLocalStorage = (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn('Could not load from localStorage:', error);
      return null;
    }
  };

  // Download as CSV
  const downloadCSV = (filename, dataToDownload) => {
    if (dataToDownload.length === 0) {
      setError('No processed data to download');
      return;
    }

    try {
      const csv = Papa.unparse(dataToDownload);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
      setError('Error downloading file: ' + error.message);
    }
  };

  // Create sample data for testing
  const createSampleData = () => {
    const sampleData = [
      {CUSTID: 9591943, FNAME: 'ANDREW', LNAME: 'DONATI', EMAIL: 'AND.DON@SNOW.EDU', LICENSE_TYPE: 'Combination', RES_FLAG: 'Resident'},
      {CUSTID: 9591944, FNAME: 'SARAH', LNAME: 'JOHNSON', EMAIL: 'sarah.j@email.com', LICENSE_TYPE: 'Hunting', RES_FLAG: 'Resident'},
      {CUSTID: 9591945, FNAME: 'MIKE', LNAME: 'SMITH', EMAIL: 'mike@test.com', LICENSE_TYPE: 'Fishing', RES_FLAG: 'Non-Resident'},
      {CUSTID: 9591946, FNAME: 'LISA', LNAME: 'BROWN', EMAIL: 'sarah.j@email.com', LICENSE_TYPE: 'Combination', RES_FLAG: 'Resident'},
      {CUSTID: 9591947, FNAME: 'JOHN', LNAME: 'DOE', EMAIL: 'john.doe@example.com', LICENSE_TYPE: 'Hunting', RES_FLAG: 'Resident'},
      {CUSTID: 9591948, FNAME: 'JANE', LNAME: 'DOE', EMAIL: 'john.doe@example.com', LICENSE_TYPE: 'Fishing', RES_FLAG: 'Resident'},
      {CUSTID: 9591949, FNAME: 'PETER', LNAME: 'PARKER', EMAIL: 'p.parker@dailybugle.com', LICENSE_TYPE: 'Combination', RES_FLAG: 'Non-Resident'},
      {CUSTID: 9591950, FNAME: 'MARY', LNAME: 'JANE', EMAIL: 'p.parker@dailybugle.com', LICENSE_TYPE: 'Hunting', RES_FLAG: 'Resident'}
    ];
    setData(sampleData);
    setProcessedData([]);
    setDuplicateStats({});
    setError('');
  };

  // Effect to load data from localStorage on component mount
  useEffect(() => {
    const loadedData = loadFromLocalStorage('lastProcessedData');
    const loadedStats = loadFromLocalStorage('lastProcessingStats');
    if (loadedData) {
      setProcessedData(loadedData);
    }
    if (loadedStats) {
      setDuplicateStats(loadedStats);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900">Excel Data Processor</h1>
          <p className="text-gray-600 mt-2">Email Campaign & Deduplication Tool</p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {['upload', 'exercise1', 'exercise2'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'upload' && 'Upload Data'}
                {tab === 'exercise1' && 'Exercise 1: Email Campaign'}
                {tab === 'exercise2' && 'Exercise 2: Deduplication'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Excel File</h3>
              <p className="text-gray-500 mb-6">Select your Excel file to begin processing</p>
              
              <div className="space-y-4">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                  className="block mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
                
                <div className="text-gray-500">or</div>
                
                <button
                  onClick={createSampleData}
                  disabled={isLoading}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
                >
                  Use Sample Data for Testing
                </button>
              </div>
              
              {isLoading && (
                <div className="mt-6 text-blue-600">
                  Processing file...
                </div>
              )}
              
              {data.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="inline h-5 w-5 text-green-500 mr-2" />
                  <span className="text-green-700">
                    Loaded {data.length} records from {fileName}
                  </span>
                  <div className="mt-2 text-sm text-green-600">
                    Sample columns: {Object.keys(data[0] || {}).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exercise 1 Tab */}
          {activeTab === 'exercise1' && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Mail className="mr-2 h-6 w-6 text-blue-500" />
                Exercise 1: Email Campaign Preparation
              </h3>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-blue-900 mb-2">Requirements:</h4>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• Email as primary key in first column (renamed to "Destination")</li>
                  <li>• Names in proper case, separated into "First Name" and "Last Name"</li>
                  <li>• Ready for MS-DOS CSV export</li>
                </ul>
              </div>

              {data.length === 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                  <AlertCircle className="inline h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-yellow-700">
                    Please upload data first or use sample data from the Upload tab
                  </span>
                </div>
              )}

              <button
                onClick={processExercise1}
                disabled={data.length === 0 || isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 mb-4"
              >
                {isLoading ? 'Processing...' : 'Process for Email Campaign'}
              </button>

              {exercise1ProcessedData.length > 0 && (
                <div>
                  <div className="bg-green-50 p-4 rounded-lg mb-4">
                    <CheckCircle className="inline h-5 w-5 text-green-500 mr-2" />
                    <span className="text-green-700">
                      Processed {exercise1ProcessedData.length} records ready for email campaign
                    </span>
                  </div>

                  <button
                    onClick={() => downloadCSV('email_campaign_data.csv', exercise1ProcessedData)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mb-4 flex items-center"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download MS-DOS CSV
                  </button>

                  {/* Preview Table */}
                  <div className="overflow-x-auto table-container">
                    <table className="min-w-full bg-white border border-gray-300">
                      <thead className="sticky top-0">
                        <tr className="bg-gray-50">
                          {Object.keys(exercise1ProcessedData[0] || {}).map(key => (
                            <th key={key} className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {exercise1ProcessedData.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.values(row).map((value, cellIdx) => (
                              <td key={cellIdx} className="border border-gray-300 px-4 py-2 text-sm">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {exercise1ProcessedData.length > 20 && (
                      <p className="text-gray-500 text-sm mt-2">
                        Showing first 20 of {exercise1ProcessedData.length} records
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Exercise 1 Solution Explanation */}
              <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Exercise 1 Solution Explanation</h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 mb-4">
                    <strong>Challenge:</strong> Prepare raw Excel data for an email campaign, requiring specific formatting and data cleansing.
                  </p>
                  <h4 className="font-semibold text-gray-900 mb-2">Solution Strategy:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li><strong>Standardize Email:</strong> Convert email addresses to lowercase and trim whitespace to ensure consistency.</li>
                    <li><strong>Proper Case Names:</strong> Transform first and last names to proper case (e.g., 'JOHN DOE' becomes 'John Doe').</li>
                    <li><strong>Field Mapping & Renaming:</strong> Map original column headers to desired output headers (e.g., 'EMAIL' to 'Destination', 'FNAME' to 'First Name').</li>
                    <li><strong>Filter Invalid Entries:</strong> Remove any rows that do not have a valid email, first name, or last name after processing to ensure data quality for the campaign.</li>
                  </ol>
                  <p className="text-gray-700 mt-4">
                    This exercise focuses on data transformation and basic cleaning to ensure the generated CSV file is directly usable by email marketing platforms, adhering to common requirements for email campaign data.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Exercise 2 Tab */}
          {activeTab === 'exercise2' && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Users className="mr-2 h-6 w-6 text-purple-500" />
                Exercise 2: Email Deduplication & Personalization
              </h3>
              
              <div className="bg-purple-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-purple-900 mb-2">Challenge:</h4>
                <ul className="text-purple-800 text-sm space-y-1">
                  <li>• Customer DB allows duplicate emails (different Customer IDs)</li>
                  <li>• Email DB requires unique emails as primary key</li>
                  <li>• Each customer must receive personalized email</li>
                </ul>
              </div>

              {data.length === 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                  <AlertCircle className="inline h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-yellow-700">
                    Please upload data first or use sample data from the Upload tab
                  </span>
                </div>
              )}

              <button
                onClick={processExercise2}
                disabled={data.length === 0 || isLoading}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 mb-4"
              >
                {isLoading ? 'Processing...' : 'Process with Deduplication'}
              </button>

              {processedData.length > 0 && duplicateStats.totalRecords && (
                <div>
                  {/* Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{duplicateStats.totalRecords}</div>
                      <div className="text-blue-800">Total Records</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{duplicateStats.uniqueEmails}</div>
                      <div className="text-green-800">Unique Emails</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{duplicateStats.duplicateEmails}</div>
                      <div className="text-orange-800">Duplicate Emails</div>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadCSV('deduplicated_email_data.csv', processedData)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mb-4 flex items-center"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Deduplicated Data
                  </button>

                  {/* Duplicate Groups Analysis */}
                  {duplicateStats.duplicateGroups && duplicateStats.duplicateGroups.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3 flex items-center">
                        <AlertCircle className="mr-2 h-5 w-5 text-orange-500" />
                        Duplicate Email Analysis
                      </h4>
                      <div className="bg-orange-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                        {duplicateStats.duplicateGroups.slice(0, 10).map((group, idx) => (
                          <div key={idx} className="mb-3 p-3 bg-white rounded border">
                            <div className="font-medium text-orange-800">{group.email}</div>
                            <div className="text-sm text-orange-700">
                              {group.count} accounts: {group.customers.map(c => `${c.firstName} ${c.lastName} (ID: ${c.custId})`).join(', ')}
                            </div>
                          </div>
                        ))}
                        {duplicateStats.duplicateGroups.length > 10 && (
                          <p className="text-orange-600 text-sm">
                            ... and {duplicateStats.duplicateGroups.length - 10} more duplicate groups
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="overflow-x-auto table-container">
                    <table className="min-w-full bg-white border border-gray-300">
                      <thead className="sticky top-0">
                        <tr className="bg-gray-50">
                          {Object.keys(processedData[0] || {}).map(key => (
                            <th key={key} className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className={`hover:bg-gray-50 ${row['Multiple Accounts'] === 'Yes' ? 'bg-yellow-50' : ''}`}>
                            {Object.values(row).map((value, cellIdx) => (
                              <td key={cellIdx} className="border border-gray-300 px-4 py-2 text-sm">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {processedData.length > 20 && (
                      <p className="text-gray-500 text-sm mt-2">
                        Showing first 20 of {processedData.length} records (yellow rows indicate multiple accounts per email)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Exercise 2 Solution Explanation */}
              <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Exercise 2 Solution Explanation</h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 mb-4">
                    <strong>Challenge:</strong> Moving from Customer ID-based database (allows duplicate emails) to Email-based database (requires unique emails) while ensuring proper personalization.
                  </p>
                  
                  <h4 className="font-semibold text-gray-900 mb-2">Solution Strategy:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li><strong>Group by Email:</strong> Identify all customer records sharing the same email address</li>
                    <li><strong>Analyze Duplicates:</strong> Determine if multiple accounts belong to the same person or different people</li>
                    <li><strong>Personalization Strategy:</strong>
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>Single account per email: Use individual's name and details</li>
                        <li>Multiple accounts: First and Last Name fields will contain comma-separated lists of unique names, and all Customer IDs will be listed.</li>
                      </ul>
                    </li>
                    <li><strong>Data Integrity:</strong> Maintain Customer ID tracking for audit purposes and customer service</li>
                    <li><strong>Email Content Adaptation:</strong> Flag records with multiple accounts for custom email templates</li>
                  </ol>
                  
                  <p className="text-gray-700 mt-4">
                    This approach ensures each email address receives exactly one email while maintaining the ability to personalize content appropriately and preserve the relationship between multiple customer accounts and shared email addresses.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelProcessor;