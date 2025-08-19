import React from 'react'

export default function Container({children}) {
  return (
    <div style={{maxWidth:1600,margin:"0 auto",padding:10}}>{children}</div>
  )
}
