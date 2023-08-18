import * as React from "react"

import { Uniform, Vector2 } from "three"
import { Effect } from "postprocessing"

const fragmentShader = `
  uniform bool active;
  uniform float fragments;
  vec2 rotatePoint(in vec2 pt, in vec2 center, in float angle) {
    float sinAngle = sin(angle);
    float cosAngle = cos(angle);
    pt -= center;
    vec2 r = vec2(pt.x * cosAngle - pt.y * sinAngle, pt.x * sinAngle + pt.y * cosAngle);
    r += center;
    return r;
  }
  void mainUv(inout vec2 uv) {
    if(active) {
      float circle = length(uv - 0.5);
      uv = rotatePoint(
        uv.xy,
        vec2(0.5, 0.5),
        0.1 * (1. - (mod(floor(circle * fragments), 2.)))
      );
    }
  }
`

export class CircleLensEffect extends Effect {
	resolution: Vector2
	fragments: number
	constructor(fragments = 5.0) {
		super("CircleLensEffect", fragmentShader, {
			uniforms: new Map<string, Uniform<boolean | number>>([
				["active", new Uniform(false)],
				["fragments", new Uniform(fragments)],
			]),
		})

		this.resolution = new Vector2()

		this.fragments = fragments
	}

	getFragments() {
		return this.fragments
	}

	setFragments(fragments: number) {
		fragments = Math.floor(fragments)

		const uniforms = this.uniforms
		uniforms.get("active")!.value = fragments > 0.0
		uniforms.get("fragments")!.value = fragments

		this.fragments = fragments
	}

	setSize(width: number, height: number) {
		this.resolution.set(width, height)
		this.setFragments(this.fragments)
	}
}
const CircleLens = React.forwardRef<unknown, { fragments: number }>(
	({ fragments = 5 }, ref) => {
		const effect = React.useMemo(
			() => new CircleLensEffect(fragments),
			[fragments],
		)
		return <primitive ref={ref} object={effect} dispose={null} />
	},
)

export default CircleLens
