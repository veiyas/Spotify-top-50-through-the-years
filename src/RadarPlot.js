import { scaleLinear, select, line, path, selectAll } from 'd3';

// Class to create a RadarPlot of the stats of a single song
// Inspired by https://yangdanny97.github.io/blog/2019/03/01/D3-Spider-Chart
export default class RadarPlot {
  /** propsToUse is a Set */
  constructor(song) {
    this.song = song;
    this.oldSong = 0;
    this.div = document.getElementById('radar-plot');
    this.propsToUse = new Set([
      'nrgy',
      'dnce',
      'live',
      'val',
      'acous',
      'spch',
      'pop',
    ]);

    // Calculate width, height, etc.
    const containerWidth = this.div.clientWidth;
    this.margin = { top: 0, right: 10, bottom: 10, left: 10 };
    this.width = containerWidth - this.margin.left - this.margin.right;
    this.height = containerWidth - this.margin.top - this.margin.bottom;

    // Clear previous content
    this.div.innerHTML = '';

    // Put plot svg to this.div
    this.svg = select(this.div)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);

    // Create a group in svg for the actual plot space
    this.plot = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.radialScale = scaleLinear()
      .domain([0, 100])
      .range([0, this.width / 2 - 60]);
    this.features = [];

    this.draw();
  }

  draw() {
    if(this.song === undefined) { return 0; }
    // The name of the dimensions to use for plotting
    const songFeatures = Object.keys(this.song).filter((key) =>
      this.propsToUse.has(key)
    );
    this.features = songFeatures;

    // Prepare the data
    const coordinates = this.getPathCoordinates(this.song);

    // Draw the data with a <path>
    this.svg
      .append('path')
      .datum(coordinates)
      .attr(
        'd',
        line()
          .x((d) => d.x)
          .y((d) => d.y)
      )
      .attr('class', 'shape');

    // Create circles and incremental ticks
    const ticks = [20, 40, 60, 80, 100];
    ticks.forEach((t) =>
      this.svg
        .append('circle')
        .attr('cx', this.width / 2)
        .attr('cy', this.height / 2)
        .attr('fill', 'none')
        .attr('stroke', 'gray')
        .attr('r', this.radialScale(t))
    );

    // Append the circles
    ticks.forEach((t) =>
      this.svg
        .append('text')
        .attr('x', this.width / 2 + 2)
        .attr('y', this.height / 2 - 2 - this.radialScale(t))
        .text(t.toString())
    );

    // Draw axis lines and labels
    for (var i = 0; i < songFeatures.length; i++) {
      let ft_name = songFeatures[i];
      let angle = Math.PI / 2 + (2 * Math.PI * i) / songFeatures.length;
      let line_coordinate = this.angleToCoordinate(angle, 100);
      let label_coordinate = this.angleToCoordinate(angle, 110);

      // Draw axis line
      this.svg
        .append('line')
        .attr('x1', this.width / 2)
        .attr('y1', this.height / 2)
        .attr('x2', line_coordinate.x)
        .attr('y2', line_coordinate.y)
        .attr('stroke', 'white');

      // Draw axis label
      this.svg
        .append('text')
        .attr('x', label_coordinate.x - 15)
        .attr('y', label_coordinate.y)
        .text(ft_name)
        .attr('class', 'axis-label');
    }    
    
    // Display textual song info
    document.getElementById('song-info').innerHTML = '';
    document.getElementById('song-data').innerHTML = '';
    select('#song-info')
      .append('p')
      .text(
          this.song['title'] +
          ' (' +
          this.song['year'].getFullYear() +
          ')'
      )
      .append('p')
      .text(this.song['artist']);
    select('#song-data')
      .append('p')
      .text(
        '' +
          (this.song['dur'] / 60).toFixed(0) +
          ' min ' +
          (this.song['dur'] % 60).toFixed(0) +
          ' sec'
      )
      .append('p')
      .text('' + this.song['bpm'] + ' bpm');
  }

  getPathCoordinates(data_point) {
    const coordinates = [];
    for (var i = 0; i < this.features.length; i++) {
      const ft_name = this.features[i];
      const angle = Math.PI / 2 + (2 * Math.PI * i) / this.features.length;
      coordinates.push(this.angleToCoordinate(angle, data_point[ft_name]));
    }
    return coordinates;
  }

  angleToCoordinate(angle, value) {
    const x = Math.cos(angle) * this.radialScale(value);
    const y = Math.sin(angle) * this.radialScale(value);
    return { x: this.width / 2 + x, y: this.height / 2 - y };
  }

  setData(newSong) {
    // Temp debugging stuff
    // Animating spider plots has proved to be hard
    this.oldSong = this.song;
    this.song = newSong;
    console.log(selectAll('path'));
    console.log(this.svg);
    this.draw();
  }
}
