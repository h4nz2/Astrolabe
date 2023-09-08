import * as React from "react"
import styled from "@emotion/styled"
import { css } from "@emotion/react"

const Button = styled.button<SliderArrowProps>`
	position: absolute;
	top: 2.5%;
	padding: 0 10px;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: center;

	background-color: transparent;
	color: white;
	text-decoration: none;
	transition: all 0.2s linear;
	cursor: pointer;
	&:hover {
		color: ${({ theme }) => theme.colors.red[4]};
	}
	&:disabled {
		color: ${({ theme }) => theme.colors.dark[4]};
		svg {
			stroke: ${({ theme }) => theme.colors.dark[4]};
			polyline {
				stroke: ${({ theme }) => theme.colors.dark[4]};
			}
		}
		cursor: none;
	}
	border: none;
	${({ prev }) =>
		prev
			? css`
					left: 0;
			  `
			: css`
					right: 0;
			  `}
`

const ButtonContainer = styled.div<SliderArrowProps>`
	display: flex;
	flex-direction: column;
`
const ButtonTitle = styled.span`
	font-family: "ff-meta-serif-web-pro";
	text-transform: uppercase;
	font-size: 18px;
`

const ArrowSvg = styled.svg<SliderArrowProps>`
	width: 71px;
	height: 15px;

	${({ prev }) =>
		prev &&
		css`
			transform: rotate(180deg);
		`}
`

export type SliderArrowProps = { prev?: boolean }
export type SliderArrowContainerProps = SliderArrowProps &
	Pick<
		React.ComponentPropsWithoutRef<"button">,
		"onClick" | "disabled" | "onMouseEnter" | "onMouseLeave"
	>

export const SliderArrow = React.forwardRef<SVGGElement, SliderArrowProps>(
	({ prev }, ref) => (
		<ArrowSvg
			prev={prev}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 60 15"
		>
			<g ref={ref}>
				<polyline
					id="large-arrow__head"
					points="43 2.775 49.125 7.5 43 12.5"
					fill="none"
					stroke="white"
					strokeMiterlimit="10"
				/>
				<rect x="1" y="7" width="46.5" height="1" fill="white" />
			</g>
		</ArrowSvg>
	),
)

SliderArrow.displayName = "Arrow"

export const PrevNextButton = React.forwardRef<
	HTMLButtonElement,
	SliderArrowContainerProps
>(({ prev, onClick, disabled, onMouseEnter, onMouseLeave }, ref) => (
	<Button
		prev={prev}
		ref={ref}
		onMouseEnter={onMouseEnter}
		onMouseLeave={onMouseLeave}
		onClick={onClick}
		disabled={disabled}
	>
		<ButtonContainer prev={prev}>
			<SliderArrow prev={prev} />
			<ButtonTitle>{prev ? "Prev" : "Next"}</ButtonTitle>
		</ButtonContainer>
	</Button>
))
