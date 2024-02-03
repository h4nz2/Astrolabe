import { ComponentPropsWithoutRef, forwardRef } from "react"
import styled from "@emotion/styled"
import { css } from "@emotion/react"

type ButtonProps = { prev?: boolean }

const Button = styled.button<ButtonProps>`
	position: absolute;
	top: 1rem;

	background-color: transparent;
	color: white;
	text-decoration: none;
	transition: color 0.2s linear;
	cursor: pointer;

	&:focus,
	&:hover {
		color: ${({ theme }) => theme.colors.orange[7]};
	}
	&:disabled {
		color: ${({ theme }) => theme.colors.dark[4]};
		svg {
			stroke: ${({ theme }) => theme.colors.dark[4]};
			polyline {
				stroke: ${({ theme }) => theme.colors.dark[4]};
			}
		}
		pointer-events: none;
		cursor: auto;
	}
	border: none;
	${({ prev }) =>
		prev
			? css`
					left: 1rem;
			  `
			: css`
					right: 1rem;
			  `}
`

const Inner = styled.div`
	display: flex;
	flex-direction: column;
`
const Label = styled.span`
	text-transform: uppercase;
	font-size: 18px;
`

const ArrowSvg = styled.svg<ButtonProps>`
	width: 70px;
	height: 15px;
	transform: rotate(${({ prev }) => (prev ? 180 : 0)}deg);
`

const PrevNextButton = forwardRef<
	HTMLButtonElement,
	ButtonProps &
		Pick<
			ComponentPropsWithoutRef<"button">,
			"onClick" | "disabled" | "onMouseEnter" | "onMouseLeave"
		>
>(({ prev, onClick, disabled, onMouseEnter, onMouseLeave }, ref) => (
	<Button
		prev={prev}
		ref={ref}
		onMouseEnter={onMouseEnter}
		onMouseLeave={onMouseLeave}
		onClick={onClick}
		disabled={disabled}
	>
		<Inner>
			<ArrowSvg
				prev={prev}
				viewBox="0 0 60 15"
				style={{ transition: "stroke 1s ease-in-out" }}
			>
				<g>
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
			<Label>{prev ? "Prev" : "Next"}</Label>
		</Inner>
	</Button>
))

export default PrevNextButton
