function preprocessCores(cores) {
  const minX = Math.min(...cores.map((core) => core.x));
  const maxY = Math.max(...cores.map((core) => core.y));
  return cores.map((core) => ({ x: core.x - minX, y: maxY - core.y }));
}
let cores = await fetch("augmented_labels/158871_aug_6.json")
  .then((response) => response.json())
  .then((data) => {
    return preprocessCores(data);
  });

function getEdgesFromTriangulation(cores) {
  const delaunay = d3.Delaunay.from(cores.map((core) => [core.x, core.y]));
  const triangles = delaunay.triangles;
  const edges = new Set();

  for (let i = 0; i < triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const index1 = triangles[i + j];
      const index2 = triangles[i + ((j + 1) % 3)];
      const edge = [Math.min(index1, index2), Math.max(index1, index2)]; // Ensuring smaller index comes first
      edges.add(edge.join(","));
    }
  }

  return Array.from(edges).map((edge) => edge.split(",").map(Number));
}

function calculateEdgeLengths(edges, coordinates) {
  return edges.map(([start, end]) => {
    const dx = coordinates[end].x - coordinates[start].x;
    const dy = coordinates[end].y - coordinates[start].y;
    return Math.sqrt(dx * dx + dy * dy);
  });
}
function orderEdgesToPointRight(filteredEdges, coordinates) {
    return filteredEdges.map(([start, end]) => {
        return coordinates[start].x > coordinates[end].x ? [end, start] : [start, end];
    });
}
function filterEdgesByLength(edges, coordinates, thresholdMultiplier = 1.5) {
    const edgeLengths = calculateEdgeLengths(edges, coordinates);
    const median = math.median(edgeLengths);
    const mad = math.median(edgeLengths.map(len => Math.abs(len - median)));
    const lowerBound = median - thresholdMultiplier * mad;
    const upperBound = median + thresholdMultiplier * mad;

    const filteredEdges = edges.filter((edge, index) => {
        const length = edgeLengths[index];
        return length <= upperBound;
    });

    return orderEdgesToPointRight(filteredEdges, coordinates);
}
function angleWithXAxis(startCoord, endCoord) {
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const angleRadians = Math.atan2(dy, dx);
    return angleRadians * (180 / Math.PI);
}

function filterEdgesByAngle(edges, coordinates, thresholdAngle, originAngle) {
    return edges.filter(([start, end]) => {
        const startCoord = coordinates[start];
        const endCoord = coordinates[end];
        const angle = angleWithXAxis(startCoord, endCoord);

        // Normalize angles to be within -180 to 180 degrees
        let normalizedAngle = normalizeAngleDegrees(angle);
        
        // Check if the edge angle is within the threshold from the origin angle
        return normalizedAngle <= originAngle + thresholdAngle &&
            normalizedAngle >= originAngle - thresholdAngle;
    });
}

function limitConnections(edges, coordinates) {
    // Step 1: Calculate distances for all connections
    let allConnections = {};
    edges.forEach(edge => {
        const [pointA, pointB] = edge;
        const dx = coordinates[pointB].x - coordinates[pointA].x;
        const dy = coordinates[pointB].y - coordinates[pointA].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        allConnections[pointA] = allConnections[pointA] || [];
        allConnections[pointB] = allConnections[pointB] || [];
        allConnections[pointA].push({ point: pointB, distance: distance });
        allConnections[pointB].push({ point: pointA, distance: distance });
    });

    // Step 2: Sort connections for each point
    Object.keys(allConnections).forEach(point => {
        allConnections[point].sort((a, b) => a.distance - b.distance);
    });

    // Step 3: Select the closest point in each direction mutually
    let mutualConnections = {};
    Object.keys(allConnections).forEach(point => {
        allConnections[point].forEach(connection => {
            const connectedPoint = connection.point;
            if (coordinates[connectedPoint].x < coordinates[point].x) {  // Connected point is to the left
                if (!mutualConnections[point] || !mutualConnections[point].left || connection.distance < mutualConnections[point].left.distance) {
                    mutualConnections[point] = mutualConnections[point] || {};
                    mutualConnections[point].left = { point: connectedPoint, distance: connection.distance };
                }
            } else if (coordinates[connectedPoint].x > coordinates[point].x) {  // Connected point is to the right
                if (!mutualConnections[point] || !mutualConnections[point].right || connection.distance < mutualConnections[point].right.distance) {
                    mutualConnections[point] = mutualConnections[point] || {};
                    mutualConnections[point].right = { point: connectedPoint, distance: connection.distance };
                }
            }
        });
    });

    // Step 4: Confirm the directionality is mutual
    let finalEdges = new Set();
    Object.keys(mutualConnections).forEach(point => {
        const directions = mutualConnections[point];
        Object.keys(directions).forEach(direction => {
            const connectedPoint = directions[direction].point;
            const oppositeDirection = direction === 'right' ? 'left' : 'right';
            if (mutualConnections[connectedPoint] && mutualConnections[connectedPoint][oppositeDirection] && mutualConnections[connectedPoint][oppositeDirection].point == point) {
                finalEdges.add(JSON.stringify([Math.min(point, connectedPoint), Math.max(point, connectedPoint)].sort()));
            }
        });
    });

    // Return the list of final edges
    return Array.from(finalEdges).map(edge => JSON.parse(edge));
}

function visualizeCores(cores, svgId) {
    const svg = d3.select(svgId);
    svg.selectAll("circle")
       .data(cores)
       .enter()
       .append("circle")
       .attr("cx", d => d.x)
       .attr("cy", d => d.y)
       .attr("r", 3)
       .attr("fill", "blue");
}

function visualizeEdges(edges, coordinates, svgId, color = "black") {
    const svg = d3.select(svgId);
    edges.forEach(edge => {
        const [start, end] = edge;
        svg.append("line")
           .attr("x1", coordinates[start].x)
           .attr("y1", coordinates[start].y)
           .attr("x2", coordinates[end].x)
           .attr("y2", coordinates[end].y)
           .attr("stroke", color)
           .attr("stroke-width", 1);
    });
}

// Helper function to calculate distance between two points
function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

// Helper function to normalize an angle between 0 and 360 degrees
function normalizeAngleDegrees(angle) {
    return angle % 360;
}

// Helper function to check if a point is within the circular sector
function pointInSector(V_prime, Vj, r, phi = 360, originAngle = 0) {
    let distance = calculateDistance(V_prime, Vj);
    if (distance > r) return false;

    return true

    // let angleVjVPrime = angleWithXAxis(Vj, V_prime);
    // let startAngle = normalizeAngleDegrees(originAngle - phi / 2);
    // let endAngle = normalizeAngleDegrees(originAngle + phi / 2);
    // angleVjVPrime = normalizeAngleDegrees(angleVjVPrime);

    // if (startAngle < endAngle) {
    //     return startAngle <= angleVjVPrime && angleVjVPrime <= endAngle;
    // } else {
    //     return angleVjVPrime >= startAngle || angleVjVPrime <= endAngle;
    // }
}

// Helper function to check if point is close to image width
function isCloseToImageWidth(point, imageWidth, gamma) {
    return Math.abs(point[0] - imageWidth) < gamma;
}

// Main traveling algorithm
function traveling_algorithm(S, imageWidth, d, gamma, phi = 180, originAngle = 0, radiusMultiplier = 0.5) {
    let A = [];
    let r = radiusMultiplier * d;
    let imaginaryPointsIndex = -1;

    S = S.map((v, i) => ({ 
        start: v[0], 
        end: v[1], 
        index: i, 
        isImaginary: false 
    }));

    while (S.length > 0) {
        let startVector = S.reduce((prev, curr) => (prev.start[0] < curr.start[0] ? prev : curr));
        let A1 = [startVector];
        let Vj = startVector.end;
        S = S.filter(v => v.index !== startVector.index);

        let firstImaginary = true;
        while (true) {
            let nextVector = S.find(v => calculateDistance(v.start, Vj) < 1e-3);
            if (nextVector) {
                Vj = nextVector.end;
                A1.push(nextVector);
                S = S.filter(v => v.index !== nextVector.index);
                firstImaginary = true;
            } else {
                if (!isCloseToImageWidth(Vj, imageWidth, gamma)) {
                    let candidates = S.filter(v => pointInSector(v.start, Vj, r, phi, originAngle));
                    if (candidates.length > 0) {
                        let closestVector = candidates.reduce((prev, curr) => (calculateDistance(curr.end, Vj) < calculateDistance(prev.end, Vj) ? curr : prev));
                        Vj = closestVector.end;
                        A1.push(closestVector);
                        S = S.filter(v => v.index !== closestVector.index);
                        firstImaginary = true;
                    } else {
                        let deltaRad = originAngle * (Math.PI / 180);
                        let VjPrime = [Vj[0] + d * Math.cos(deltaRad), Vj[1] + d * Math.sin(deltaRad)];
                        let imaginaryVector = { start: Vj, end: VjPrime, index: imaginaryPointsIndex, isImaginary: true };
                        A1.push(imaginaryVector);
                        Vj = VjPrime;
                        imaginaryPointsIndex--;
                        firstImaginary = false;
                    }
                } else {
                    let uniqueRow = A1.map(vec => ({ point: vec.start, index: vec.index, isImaginary: vec.isImaginary }))
                        .filter((v, i, self) => self.findIndex(t => t.point[0] === v.point[0] && t.point[1] === v.point[1]) === i);
                    A.push(uniqueRow);
                    break;
                }
            }
        }
    }
    return A;
}
function isPointInList(pointIndex, edgeList) {
    return edgeList.some(edge => edge[0] === pointIndex || edge[1] === pointIndex);
}

function sortEdgesAndAddIsolatedPoints(bestEdgeSet, normalizedCoordinates) {
    // Sort edges so that the point with the smaller x-coordinate comes first
    let sortedEdges = bestEdgeSet.map(edge => {
        const [start, end] = edge;
        return normalizedCoordinates[start].x <= normalizedCoordinates[end].x ? [start, end] : [end, start];
    });

    // Find all indices that are not included in any edge
    let isolatedIndices = normalizedCoordinates.map((_, index) => index)
        .filter(index => !isPointInList(index, sortedEdges));

    // Create edges for isolated points (self-referential)
    let isolatedPointsInput = isolatedIndices.map(index => [index, index]);

    // Combine sorted edges with isolated points
    let bestEdgeSetIndices = sortedEdges.concat(isolatedPointsInput);

    return bestEdgeSetIndices;
}

function visualizeSortedRows(rows, svgId) {
    const svg = d3.select(svgId);
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    const realPointColor = 'blue';
    const imaginaryPointColor = 'red';
    const offset = 5;

    // Flatten rows and find the extents for scaling
    const allPoints = rows.flatMap(row => row.map(pointInfo => pointInfo.point));
    const xExtent = d3.extent(allPoints, d => d[0]);
    const yExtent = d3.extent(allPoints, d => d[1]);

    // Create scales
    const xScale = d3.scaleLinear().domain(xExtent).range([10, width - 10]);
    const yScale = d3.scaleLinear().domain(yExtent).range([height - 10, 10]);

    // Plot each point and add labels
    rows.forEach((row, rowIdx) => {
        row.forEach((pointInfo, colIdx) => {
            const [x, y] = pointInfo.point;
            const isImaginary = pointInfo.isImaginary;
            const color = isImaginary ? imaginaryPointColor : realPointColor;

            svg.append("circle")
                .attr("cx", xScale(x))
                .attr("cy", yScale(y))
                .attr("r", 5)
                .attr("fill", color);

            // Adjust text alignment to reduce overlap
            const ha = colIdx % 2 === 0 ? -offset : offset;
            const va = rowIdx % 2 === 0 ? -offset : offset;

            svg.append("text")
                .attr("x", xScale(x) + ha)
                .attr("y", yScale(y) + va)
                .text(`R${rowIdx}C${colIdx}`)
                .attr("font-size", "8px")
                .attr("text-anchor", colIdx % 2 === 0 ? "end" : "start")
                .attr("alignment-baseline", rowIdx % 2 === 0 ? "bottom" : "hanging")
                .attr("fill", color);
        });
    });

    // Add axes (optional, uncomment if needed)
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
    svg.append("g").call(xAxis).attr("transform", `translate(0,${height - 10})`);
    svg.append("g").call(yAxis).attr("transform", "translate(10,0)");

    // Add grid (optional, uncomment if needed)
    svg.append("g").call(d3.axisBottom(xScale).tickSize(-height).tickFormat(''));
    svg.append("g").call(d3.axisLeft(yScale).tickSize(-width).tickFormat(''));
}



// Wrap the data loading and processing in an async function
async function loadDataAndVisualize(cores) {
    

    const delaunay_triangle_edges = getEdgesFromTriangulation(cores);
    const length_filtered_edges = filterEdgesByLength(delaunay_triangle_edges, cores);
    const angle_filtered_edges = filterEdgesByAngle(length_filtered_edges, cores, 10, 0);
    const limited_edges = limitConnections(angle_filtered_edges, cores);

    // Visualize original cores
    visualizeCores(cores, "#svg-cores");

    // Visualize edges after Delaunay triangulation
    visualizeEdges(delaunay_triangle_edges, cores, "#svg-delaunay", "red");

    // Visualize edges after length filtering
    visualizeEdges(length_filtered_edges, cores, "#svg-length-filtered", "green");

    // Visualize edges after angle filtering
    visualizeEdges(angle_filtered_edges, cores, "#svg-angle-filtered", "blue");

    // Visualize edges after limiting connections
    visualizeEdges(limited_edges, cores, "#svg-limited-connections", "purple");

    const traveling_algorithm_input = sortEdgesAndAddIsolatedPoints(limited_edges, cores);

    
    let coordinatesInput = traveling_algorithm_input.map(([start, end]) => {
        return [[cores[start].x, cores[start].y], [cores[end].x, cores[end].y]];
    });
    


    let averageDistances = [];
    for (let edge of coordinatesInput) {
        let start = edge[0], end = edge[1];
        let distance = Math.sqrt(Math.pow(start[0] - end[0], 2) + Math.pow(start[1] - end[1], 2));
        averageDistances.push(distance);
    }

    let averageDistance = math.median(averageDistances); // Assuming median is a function you have defined or imported

    function calculateGridWidth(centers, d, multiplier) {
        let maxX = Math.max(...centers.map(center => center.x));
        return maxX + multiplier * d;
    }

    // Calculate the average core-to-core distance
    let d = averageDistance;

    // Calculate Y (here, imageWidth)
    let imageWidth = calculateGridWidth(cores, d, 1.5);


    // Run traveling algorithm
    const gamma = 0.75 * d;
    const phi = 360;
    const imageRotation = 0;
    const radiusMultiplier = 0.6;
    
    

    // Assuming traveling_algorithm is a function you have defined or imported
    let rows = traveling_algorithm(coordinatesInput, imageWidth, d, gamma, phi, imageRotation, radiusMultiplier);

    // Get the point with the minim

    // Assuming sortedRows is a function you have defined or imported
    let sortedRows = rows.sort((a, b) => b[0]['point'][1] - a[0]['point'][1]);

    visualizeSortedRows(sortedRows, "#visualization");

}

// Step 1: Add event listener to file input
document.getElementById('fileInput').addEventListener('change', handleFileSelect, false);

function handleFileSelect(event) {
    const reader = new FileReader();
    reader.onload = handleFileLoad;
    reader.readAsText(event.target.files[0]);
}

function handleFileLoad(event) {
    try {
        const cores = preprocessCores(JSON.parse(event.target.result));
        loadDataAndVisualize(cores);
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

// Call the function to load data and visualize
// loadDataAndVisualize().catch(error => console.error('An error occurred:', error));
