import * as React from "react"

import * as THREE from "three"

import { Canvas, useFrame } from "@react-three/fiber"
import {
	OrbitControls,
	PerspectiveCamera,
	Environment,
	MeshDistortMaterial,
	ContactShadows,
	useTexture,
	MeshReflectorMaterial,
} from "@react-three/drei"

import { useSpring, SpringValue } from "@react-spring/core"
import { a } from "@react-spring/three"
import styled from "@emotion/styled"

// React-spring animates native elements, in this case <mesh/> etc,
// but it can also handle 3rd–party objs, just wrap them in "a".
const AnimatedMaterial = a(MeshDistortMaterial)

export type ThreeDemoProps = {}

const ThreeDemo: React.FC<ThreeDemoProps> = () => {
	const [dpr, setDpr] = React.useState<number | undefined>()
	React.useEffect(() => {
		if (window) setDpr(window.devicePixelRatio)
	}, [])

	return (
		<Canvas dpr={dpr} gl={{ antialias: true }}>
			<ambientLight />
			<pointLight position={[20, 10, 10]} />
			<Scene />
			<OrbitControls
				enablePan
				enableZoom={false}
				maxPolarAngle={Math.PI / 3}
				minPolarAngle={Math.PI / 3}
			/>
		</Canvas>
	)
}

export default ThreeDemo

const Scene: React.FC = () => {
	const sphere = React.useRef<THREE.Mesh>(null!)
	const light = React.useRef<THREE.PointLight>(null!)
	const [mode, setMode] = React.useState(false)
	const [down, setDown] = React.useState(false)
	const [hovered, setHovered] = React.useState(false)

	// React.useEffect(() => {
	// 	document.body.style.cursor = hovered
	// 		? "none"
	// 		: `url('data:image/svg+xml;base64,${btoa(
	// 				'<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="10" fill="#E8B059"/></svg>'
	// 		  )}'), auto`
	// }, [hovered])

	// Make the bubble float and follow the mouse
	// This is frame-based animation, useFrame subscribes the component to the render-loop
	useFrame((state) => {
		if (light.current) {
			light.current.position.x = state.mouse.x * 20
			light.current.position.y = state.mouse.y * 20
		}
		if (sphere.current) {
			sphere.current.position.x = THREE.MathUtils.lerp(
				sphere.current.position.x,
				hovered ? state.mouse.x / 2 : 0,
				0.2,
			)
			sphere.current.position.y = THREE.MathUtils.lerp(
				sphere.current.position.y,
				Math.sin(state.clock.elapsedTime / 1.5) / 6 +
					(hovered ? state.mouse.y / 2 : 0),
				0.2,
			)
		}
	})

	// Springs for color and overall looks, this is state-driven animation
	// React-spring is physics based and turns static props into animated values
	const [{ coat, ambient, env }] = useSpring(
		{
			// wobble: down ? 1.2 : hovered ? 1.05 : 1,
			coat: mode && !hovered ? 0.04 : 1,
			ambient: mode && !hovered ? 1.5 : 0.5,
			env: mode && !hovered ? 0.4 : 1,
			// color: hovered ? "#E8B059" : mode ? "#202020" : "white",
			// config: (n) =>
			// 	n === "wobble" && hovered ? { mass: 2, tension: 1000, friction: 10 } : {},
		},
		[mode, hovered, down],
	)

	return (
		<>
			<PerspectiveCamera makeDefault position={[0, 10, 4]} fov={75}>
				{/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
				{/* @ts-ignore: https://github.com/pmndrs/react-spring/issues/1515 */}
				<a.ambientLight intensity={ambient} />
				<a.pointLight
					ref={light}
					position-z={-25}
					intensity={env}
					color="#F8C069"
				/>
			</PerspectiveCamera>
			<React.Suspense fallback={null}>
				<Sphere
					env={env}
					coat={coat}
					mode={mode}
					sphere={sphere}
					setHovered={setHovered}
					setDown={setDown}
					setMode={setMode}
				/>
				<ContactShadows
					rotation={[Math.PI / 2, 0, 0]}
					position={[0, -1.1, 0]}
					opacity={mode ? 0.8 : 0.4}
					width={6}
					height={6}
					blur={2}
					far={1.6}
				/>
			</React.Suspense>
		</>
	)
}

type SphereProps = {
	// color: SpringValue<string>
	env: SpringValue<number>
	coat: SpringValue<number>
	mode: boolean
	sphere: React.MutableRefObject<THREE.Mesh>
	// wobble: SpringValue<number>
	setHovered: React.Dispatch<React.SetStateAction<boolean>>
	setDown: React.Dispatch<React.SetStateAction<boolean>>
	setMode: React.Dispatch<React.SetStateAction<boolean>>
}
const Sphere: React.FC<SphereProps> = ({
	sphere,
	setHovered,
	setDown,
	setMode,
}) => {
	const texturePath = "assets/textures/earth_4k.jpg"
	return (
		<a.mesh
			ref={sphere}
			scale={[0.2, 0.2, 0.205]}
			onPointerOver={() => setHovered(true)}
			onPointerOut={() => setHovered(false)}
			onPointerDown={() => setDown(true)}
			onPointerUp={() => {
				setDown(false)
				// Toggle mode between dark and bright
				setMode((prev) => !prev)
			}}
		>
			{/* <sphereBufferGeometry args={[1, 32, 32]} /> */}

			<sphereGeometry args={[5, 50, 50]} />
			<meshBasicMaterial attach="material" map={useTexture(texturePath)} />

			{/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
			{/* @ts-ignore: https://github.com/pmndrs/react-spring/issues/1515 */}
			{/* <AnimatedMaterial
				color={color}
				envMapIntensity={env}
				clearcoat={coat}
				clearcoatRoughness={0}
				metalness={0.1}
			/> */}
		</a.mesh>
	)
}
