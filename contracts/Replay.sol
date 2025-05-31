// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProvenanceEconomy {
    uint256 constant MAX_BASIS_POINTS = 10000;

    struct Attribution {
        address contributor;
        string role; // creator, contributor, sourceMaterial, approver
        uint256 weight; // e.g. 1000 = 10%
        bool includedInCredits;
        string notes;
    }

    struct Resource {
        string cid; // IPFS hash or off-chain reference
        address submitter;
        uint256 createdAt;
        uint256 totalRevenue;
        mapping(address => uint256) claimed;
        Attribution[] attributions;
    }

    mapping(string => Resource) private resources; // resourceId => Resource
    mapping(string => bool) private resourceExists;

    event ResourceRegistered(string indexed resourceId, string cid, address indexed submitter);
    event AttributionAdded(string indexed resourceId, address indexed contributor, string role, uint256 weight);
    event RevenueDeposited(string indexed resourceId, uint256 amount);
    event Claimed(string indexed resourceId, address indexed contributor, uint256 amount);

    modifier onlySubmitter(string memory resourceId) {
        require(resources[resourceId].submitter == msg.sender, "Not the resource submitter");
        _;
    }

    function registerResource(string memory resourceId, string memory cid) external {
        require(!resourceExists[resourceId], "Resource already exists");
        Resource storage r = resources[resourceId];
        r.cid = cid;
        r.submitter = msg.sender;
        r.createdAt = block.timestamp;
        resourceExists[resourceId] = true;

        emit ResourceRegistered(resourceId, cid, msg.sender);
    }

    function addAttribution(
        string memory resourceId,
        address contributor,
        string memory role,
        uint256 weight,
        bool includedInCredits,
        string memory notes
    ) external onlySubmitter(resourceId) {
        require(resourceExists[resourceId], "Resource not found");

        Resource storage r = resources[resourceId];
        r.attributions.push(Attribution({
            contributor: contributor,
            role: role,
            weight: weight,
            includedInCredits: includedInCredits,
            notes: notes
        }));

        emit AttributionAdded(resourceId, contributor, role, weight);
    }

    function depositRevenue(string memory resourceId) external payable {
        require(resourceExists[resourceId], "Resource not found");
        resources[resourceId].totalRevenue += msg.value;

        emit RevenueDeposited(resourceId, msg.value);
    }

    function claim(string memory resourceId) external {
        require(resourceExists[resourceId], "Resource not found");
        Resource storage r = resources[resourceId];

        uint256 owed = 0;
        for (uint256 i = 0; i < r.attributions.length; i++) {
            Attribution memory a = r.attributions[i];
            if (a.contributor == msg.sender) {
                uint256 totalEntitled = (r.totalRevenue * a.weight) / MAX_BASIS_POINTS;
                uint256 alreadyClaimed = r.claimed[msg.sender];
                if (totalEntitled > alreadyClaimed) {
                    owed = totalEntitled - alreadyClaimed;
                    r.claimed[msg.sender] = totalEntitled;
                    break;
                }
            }
        }

        require(owed > 0, "Nothing to claim");
        payable(msg.sender).transfer(owed);

        emit Claimed(resourceId, msg.sender, owed);
    }

    function getAttributions(string memory resourceId) external view returns (Attribution[] memory) {
        require(resourceExists[resourceId], "Resource not found");
        return resources[resourceId].attributions;
    }

    function getResourceInfo(string memory resourceId) external view returns (
        string memory cid,
        address submitter,
        uint256 createdAt,
        uint256 totalRevenue
    ) {
        require(resourceExists[resourceId], "Resource not found");
        Resource storage r = resources[resourceId];
        return (r.cid, r.submitter, r.createdAt, r.totalRevenue);
    }

    function getClaimedAmount(string memory resourceId, address contributor) external view returns (uint256) {
        return resources[resourceId].claimed[contributor];
    }
}
