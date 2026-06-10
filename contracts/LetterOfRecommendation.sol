// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LetterOfRecommendation {
    struct Student {
        uint256 id;
        string name;
        string course;
        string email;
        bool isAdded;
        bool hasRequested;
        bool isApproved;
        string lorIpfsHash;
        address requester;
        address approver;
    }

    address public owner;
    uint256 public studentCount;
    mapping(uint256 => Student) public students;
    mapping(address => bool) public authorizedApprovers;

    event StudentAdded(uint256 indexed studentId, string name, string course, string email);
    event RecommendationRequested(uint256 indexed studentId, address indexed requester);
    event RecommendationApproved(uint256 indexed studentId, address indexed approver, string lorIpfsHash);
    event ApproverAuthorized(address indexed approver);
    event ApproverDeauthorized(address indexed approver);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedApprovers[msg.sender] || msg.sender == owner, "Not an authorized approver");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedApprovers[msg.sender] = true; // Owner is authorized by default
        emit ApproverAuthorized(msg.sender);
    }

    function addStudent(string memory _name, string memory _course, string memory _email) public returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_course).length > 0, "Course cannot be empty");
        require(bytes(_email).length > 0, "Email cannot be empty");

        studentCount++;
        students[studentCount] = Student({
            id: studentCount,
            name: _name,
            course: _course,
            email: _email,
            isAdded: true,
            hasRequested: false,
            isApproved: false,
            lorIpfsHash: "",
            requester: address(0),
            approver: address(0)
        });

        emit StudentAdded(studentCount, _name, _course, _email);
        return studentCount;
    }

    function requestRecommendation(uint256 _studentId) public {
        require(students[_studentId].isAdded, "Student does not exist");
        require(!students[_studentId].hasRequested, "Recommendation already requested");
        require(!students[_studentId].isApproved, "Recommendation already approved");

        students[_studentId].hasRequested = true;
        students[_studentId].requester = msg.sender;

        emit RecommendationRequested(_studentId, msg.sender);
    }

    function approveRecommendation(uint256 _studentId, string memory _lorIpfsHash) public onlyAuthorized {
        require(students[_studentId].isAdded, "Student does not exist");
        require(students[_studentId].hasRequested, "Recommendation request not found");
        require(!students[_studentId].isApproved, "Recommendation already approved");

        students[_studentId].isApproved = true;
        students[_studentId].lorIpfsHash = _lorIpfsHash;
        students[_studentId].approver = msg.sender;

        emit RecommendationApproved(_studentId, msg.sender, _lorIpfsHash);
    }

    function getStudent(uint256 _studentId) public view returns (
        uint256 id,
        string memory name,
        string memory course,
        string memory email,
        bool hasRequested,
        bool isApproved,
        string memory lorIpfsHash,
        address requester,
        address approver
    ) {
        require(students[_studentId].isAdded, "Student does not exist");
        Student memory student = students[_studentId];
        return (
            student.id,
            student.name,
            student.course,
            student.email,
            student.hasRequested,
            student.isApproved,
            student.lorIpfsHash,
            student.requester,
            student.approver
        );
    }

    function authorizeApprover(address _approver) public onlyOwner {
        require(_approver != address(0), "Invalid address");
        require(!authorizedApprovers[_approver], "Already authorized");
        authorizedApprovers[_approver] = true;
        emit ApproverAuthorized(_approver);
    }

    function deauthorizeApprover(address _approver) public onlyOwner {
        require(_approver != address(0), "Invalid address");
        require(authorizedApprovers[_approver], "Not currently authorized");
        authorizedApprovers[_approver] = false;
        emit ApproverDeauthorized(_approver);
    }
}
